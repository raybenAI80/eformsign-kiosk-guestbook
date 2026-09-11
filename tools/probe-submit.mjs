/** 제출 직후 무슨 일이 일어나는지 촘촘히 관찰한다(스크린샷 0.5초 간격 + 네트워크 로그). */
import fs from 'node:fs';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const PORT = arg('port', '9227');
const EV = 'D:/pjt/eformsign/kiosk-guestbook/evidence/probe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOOK = `(function(){try{var s=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(){var x=this;x.addEventListener('loadend',function(){try{if(/external_user_complete/.test(x.responseURL||''))parent.postMessage(JSON.stringify({__probe:1,status:x.status,body:String(x.responseText).slice(0,400)}),'*');}catch(e){}});return s.apply(this,arguments);};}catch(e){}})();`;
fs.mkdirSync(EV, { recursive: true });

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const t = targets.find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const events = []; const wanted = new Map();
const send = (m, p, sess) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: sess })); });
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
  if (m.method === 'Network.responseReceived') {
    const r = m.params.response;
    if (r.status >= 400 || /external_user_complete/i.test(r.url)) {
      events.push(`${r.status} ${r.url.slice(0, 200)}`);
      wanted.set(m.params.requestId, m.sessionId);
    }
  }
  if (m.method === 'Network.requestWillBeSent' && /external_user_complete/i.test(m.params.request.url)) {
    let pd = String(m.params.request.postData || '');
    pd = pd.replace(/"ozd_file_string":"[^"]*"/g, '"ozd_file_string":"<...>"').replace(/"[A-Za-z_]*file[A-Za-z_]*":"[^"]{200,}"/g, '"<bigfile>":"<...>"');
    events.push('REQ ' + m.params.request.method + ' ' + pd.slice(0, 3000));
    events.push('REQHEADERS ' + JSON.stringify(m.params.request.headers).slice(0, 800));
  }
  if (m.method === 'Network.loadingFinished' && wanted.has(m.params.requestId)) {
    const sid = wanted.get(m.params.requestId); wanted.delete(m.params.requestId);
    send('Network.getResponseBody', { requestId: m.params.requestId }, sid)
      .then(b => events.push('BODY ' + String(b.body).slice(0, 800)))
      .catch(e => events.push('BODY-ERR ' + e.message));
  }
  if (m.method === 'Target.attachedToTarget') {
    const sid = m.params.sessionId;
    send('Network.enable', {}, sid).catch(() => {});
    send('Runtime.enable', {}, sid).catch(() => {});
    send('Page.enable', {}, sid).catch(() => {});
    send('Fetch.enable', { patterns: [{ urlPattern: '*external_user_complete*', requestStage: 'Response' }] }, sid).then(()=>events.push('FETCH enabled')).catch((e) => events.push('FETCH-ERR '+e.message));
    send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK }, sid).then(() => events.push('HOOK injected ' + (m.params.targetInfo.url || '').slice(0, 60))).catch(e => events.push('HOOK-ERR ' + e.message));
  }
  if (m.method === 'Fetch.requestPaused') {
    const sid = m.sessionId;
    events.push('PAUSED ' + m.params.responseStatusCode + ' ' + m.params.request.url.slice(0, 120));
    send('Fetch.getResponseBody', { requestId: m.params.requestId }, sid)
      .then(b => { events.push('BODY ' + (b.base64Encoded ? Buffer.from(b.body, 'base64').toString('utf8') : b.body).slice(0, 800)); return send('Fetch.continueRequest', { requestId: m.params.requestId }, sid); })
      .catch(e => { events.push('BODY-ERR ' + e.message); send('Fetch.continueRequest', { requestId: m.params.requestId }, sid).catch(() => {}); });
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.sessionId) {
    events.push('CONSOLE ' + (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  }
};
await new Promise(r => ws.onopen = r);
await send('Page.enable', {});
await send('Network.enable', {});
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });

const evalJs = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.value;
const click = async (x, y, w = 1200) => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); await sleep(w); };
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${EV}/${n}.png`, Buffer.from(r.data, 'base64')); };

await send('Page.navigate', { url: 'http://localhost:8099/?idle=0&mode=immediate' });
await sleep(12000);
await evalJs("window.__kioskRestart('probe-hook')");   // 훅이 붙은 뒤 iframe 재로드
await sleep(20000);
await click(38, 196);
await click(708, 175, 11000);
await click(480, 723, 1500);
for (const ch of '프로브') await send('Input.insertText', { text: ch });
// [필수] 체크박스 2개도 체크한다
await click(371, 859, 800);
await click(371, 904, 1200);
await shot('p0-before-send');
events.length = 0;
await click(686, 973, 5000);
await shot('p1-popup');
await click(606, 639, 800);
for (let i = 1; i <= 12; i++) { await shot('p2-' + String(i).padStart(2, '0')); await sleep(1200); }
console.log('EVENTS:\n' + events.slice(-60).join('\n'));
console.log('LOG:\n' + (await evalJs('window.__kioskLog.slice(-12).join("\\n")')));
ws.close();
