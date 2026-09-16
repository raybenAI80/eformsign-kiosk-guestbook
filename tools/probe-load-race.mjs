/**
 * probe-load-race.mjs — 「로드 중 iframe load 를 제출로 오판」 레이스 재현·회귀 프로브
 *
 * 무엇을 보는가
 *   키오스크 래퍼를 열어 **아무 입력도 하지 않고** 대기한다. 이 상태에서는 제출이 있을 수
 *   없으므로 `onSubmitted` 가 한 번이라도 찍히면 오탐이다.
 *   같은 라운드에서 iframe load #1/#2 와 action_callback 의 도착 시각(ms)과
 *   작성 프레임의 이동 URL(Page.frameNavigated)을 함께 기록해 이벤트 순서를 남긴다.
 *
 * 사용법
 *   node tools/probe-load-race.mjs --root <정적 루트> --port 8099 --cdp 9233 \
 *        --query "company=<id>&template=<id>" [--rounds 10] [--wait 20000]
 *   exit 0 = 오탐 0건, exit 1 = 오탐 발생.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(arg('root', process.cwd()));
const PORT = Number(arg('port', '8099'));
const CDP = arg('cdp', '9233');
const QUERY = arg('query', '');
const ROUNDS = Number(arg('rounds', '10'));
const WAIT = Number(arg('wait', '20000'));
const OUT = arg('out', '');
const INJECT = Number(arg('inject', '0'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 정적 서버 ────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${PORT}/?debug=1${QUERY ? '&' + QUERY : ''}`;
console.log('SERVE ' + ROOT + ' → ' + URL_);

// ── CDP ─────────────────────────────────────────────────────────────────
const targets = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json();
const t = targets.find(x => x.type === 'page');
if (!t) { console.error('no CDP page target on ' + CDP); process.exit(2); }
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
let events = [];
const send = (m, p) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
  if (m.method === 'Page.frameNavigated') {
    const f = m.params.frame;
    events.push({ at: Date.now(), kind: 'frameNavigated', parent: !!f.parentId, url: (f.url || '').slice(0, 160) });
  }
};
await new Promise(r => ws.onopen = r);
await send('Page.enable', {});
await send('Runtime.enable', {});
await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });

// --latency <ms> : 회선을 느리게 흉내 내 「작성 화면 문서의 load 이벤트」를 뒤로 민다.
//   작성 화면은 func_onload(postMessage)를 자기 문서의 subresource(reCAPTCHA iframe 등)가
//   다 받아지기 전에 보낸다 → 지연을 주면 action_callback 이 load 보다 먼저 도착하는
//   순서가 안정적으로 재현된다. 이것이 오탐 레이스의 재현 조건이다.
const LATENCY = Number(arg('latency', '0'));
if (LATENCY > 0) {
  await send('Network.enable', {});
  await send('Network.emulateNetworkConditions', {
    offline: false, latency: LATENCY,
    downloadThroughput: Number(arg('bw', '200000')), uploadThroughput: Number(arg('bw', '200000'))
  });
  console.log('NETWORK latency=' + LATENCY + 'ms');
}

const evalJs = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval fail');
  return r.result.value;
};

const rounds = [];
for (let i = 1; i <= ROUNDS; i++) {
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(400);
  events = [];
  const t0 = Date.now();
  // 작성 프레임은 다른 도메인이라 별도 타깃(OOPIF)으로 뜬다 → /json 을 폴링해 이동 이력을 남긴다.
  const seen = new Set();
  const poller = setInterval(async () => {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json();
      for (const x of list) {
        if (x.type === 'page') continue;
        const k = x.id + '|' + x.url;
        if (seen.has(k)) continue;
        seen.add(k);
        events.push({ at: Date.now(), kind: 'frameNavigated', parent: true, url: '[' + x.type + '] ' + (x.url || '').slice(0, 200) });
      }
    } catch (e) { /* 폴링 실패는 무시 */ }
  }, 250);
  await send('Page.navigate', { url: URL_ });
  // --inject <ms> : 레이스를 **결정적으로** 재현한다.
  //   작성 화면 문서의 load 이벤트가 오기 전에 formReady 를 켠다 = action_callback 이
  //   같은 문서의 load 보다 먼저 도착한 상태. 현장에서 관측된 오탐이 바로 이 상태였다.
  //   결함이 있는 판이면 곧이어 도착하는 load 가 「제출 감지」로 오판된다.
  if (INJECT > 0) {
    await sleep(INJECT);
    await evalJs('(function(){var s=window.__kioskState;if(!s)return "no-state";s.formReady=true;s.formReadyAt=Date.now();s.phase="form";return "injected loads="+s.loads;})()')
      .then(v => console.log('    INJECT@' + INJECT + 'ms → ' + v)).catch(e => console.log('    INJECT 실패 ' + e.message));
    await sleep(Math.max(0, WAIT - INJECT));
  } else {
    await sleep(WAIT);
  }
  clearInterval(poller);
  let logs = [];
  try { logs = JSON.parse(await evalJs('JSON.stringify(window.__kioskLog||[])')); } catch (e) { logs = ['(로그 수집 실패) ' + e.message]; }
  const st = await evalJs('JSON.stringify(window.__kioskState||{})').catch(() => '{}');
  const state = JSON.parse(st);
  // 페이지 로그는 앞 12자가 HH:MM:SS.mmm — 라운드 시작 대비 상대 시각은 CDP 이벤트로 보정한다.
  const pick = re => logs.filter(l => re.test(l));
  const falsePositive = pick(/제출 감지|onSubmitted/).length > 0;
  const frames = events.filter(e => e.kind === 'frameNavigated').map(e => ({ ms: e.at - t0, parent: e.parent, url: e.url }));
  const r = {
    round: i, falsePositive,
    loads: state.loads, submits: state.submits, session: state.session, phase: state.phase,
    marks: pick(/iframe load|action_callback|제출 감지|onSubmitted|startSession/),
    frames
  };
  rounds.push(r);
  console.log(`R${i} ${falsePositive ? 'FALSE_POSITIVE' : 'ok'} loads=${state.loads} submits=${state.submits} session=${state.session}`);
  for (const m of r.marks) console.log('    ' + m);
  for (const f of frames) console.log(`    [frame ${f.ms}ms ${f.parent ? 'child' : 'main'}] ${f.url}`);
}

const bad = rounds.filter(r => r.falsePositive).length;
console.log(`\nROUNDS=${ROUNDS} FALSE_POSITIVE=${bad}`);
console.log('RESULT=' + (bad === 0 ? 'PASS' : 'FAIL'));
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(rounds, null, 1)); console.log('OUT ' + OUT); }
ws.close(); server.close();
process.exit(bad === 0 ? 0 : 1);
