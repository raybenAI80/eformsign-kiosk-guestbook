/** 2단계 400 원인 분리용 프로브.
 *  - external_user_complete 응답을 Fetch(Response stage) 로 가로채 본문까지 회수
 *  - iframe(OOPIF) 세션에 직접 Runtime.evaluate 하여 좌표 대신 DOM 으로 조작
 *  node probe2.mjs --port 9241 --url <kioskUrl> --tag <name> [--step dump|run]
 */
import fs from 'node:fs';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const PORT = arg('port', '9241'); const TAG = arg('tag', 'x');
const EV = 'D:/pjt/eformsign/kiosk-guestbook/evidence/cause';
fs.mkdirSync(EV, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const t = targets.find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const events = []; const sessions = new Map(); const wanted = new Map();
const send = (m, p, sess) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: sess })); });
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
  if (m.method === 'Target.attachedToTarget') {
    const sid = m.params.sessionId; sessions.set(sid, m.params.targetInfo.url);
    for (const x of ['Network.enable','Runtime.enable','Page.enable']) send(x, {}, sid).catch(()=>{});
    send('Target.setAutoAttach', { autoAttach:true, waitForDebuggerOnStart:false, flatten:true }, sid).catch(()=>{});
    send('Fetch.enable', { patterns: [{ urlPattern: '*external_user_complete*', requestStage: 'Response' }] }, sid).catch(e=>events.push('FETCHERR '+String(e.message).slice(0,80)));
    send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK }, sid).catch(()=>{});
  }
  if (m.method === 'Target.targetInfoChanged' && m.params.targetInfo) {
    for (const [sid] of sessions) {} ; if (m.sessionId) sessions.set(m.sessionId, m.params.targetInfo.url);
  }
  if (m.method === 'Network.requestWillBeSent' && /external_user_complete/i.test(m.params.request.url)) {
    let pd = String(m.params.request.postData || '').replace(/"ozd_file_string":"[^"]*"/g,'"ozd_file_string":"<...>"');
    events.push('REQ sid=' + String(m.sessionId).slice(0,8) + ' ' + pd.slice(0, 2000));
    wanted.set(m.params.requestId, m.sessionId);
  }
  if (m.method === 'Network.responseReceived' && wanted.has(m.params.requestId)) { events.push('RESP ' + m.params.response.status + ' ' + m.params.response.url.slice(0,120)); }
  if (m.method === 'Network.loadingFinished' && wanted.has(m.params.requestId)) {
    const sid = wanted.get(m.params.requestId); wanted.delete(m.params.requestId);
    send('Network.getResponseBody', { requestId: m.params.requestId }, sid)
      .then(b => events.push('BODY ' + (b.base64Encoded ? Buffer.from(b.body,'base64').toString('utf8') : String(b.body)).slice(0,1500)))
      .catch(e => events.push('BODY-ERR ' + String(e.message).slice(0,120)));
  }
  if (m.method === 'Fetch.requestPaused') {
    const sid = m.sessionId;
    events.push('PAUSED status=' + m.params.responseStatusCode + ' ' + m.params.request.url.slice(0,140));
    send('Fetch.getResponseBody', { requestId: m.params.requestId }, sid)
      .then(b => { events.push('BODY ' + (b.base64Encoded ? Buffer.from(b.body,'base64').toString('utf8') : b.body).slice(0,1500)); return send('Fetch.continueRequest', { requestId: m.params.requestId }, sid); })
      .catch(e => { events.push('BODY-ERR ' + e.message); send('Fetch.continueRequest', { requestId: m.params.requestId }, sid).catch(()=>{}); });
  }
};
const HOOK = fs.readFileSync(new URL('./hook-complete.js', import.meta.url), 'utf8');
const COLLECTOR = fs.readFileSync(new URL('./collector.js', import.meta.url), 'utf8');
await new Promise(r => ws.onopen = r);
await send('Page.enable', {}); await send('Network.enable', {});
await send('Page.addScriptToEvaluateOnNewDocument', { source: COLLECTOR });
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${EV}/${TAG}-${n}.png`, Buffer.from(r.data, 'base64')); };
const evalIn = async (sid, expr) => { try { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sid); return r.exceptionDetails ? 'EX:'+ String(r.exceptionDetails.exception?.description||'').slice(0,300) : r.result.value; } catch(e){ return 'ERR:'+String(e.message).slice(0,120); } };
const click = async (x,y,w=1000) => { await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1}); await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1}); await sleep(w); };

globalThis.__ctx = { send, evalIn, sessions, events, shot, click, sleep, ws };
const script = arg('script');
if (script) { const p = script.split(String.fromCharCode(92)).join("/"); await (await import("file:///" + p)).default(globalThis.__ctx); }
console.log('SESSIONS:'); for (const [sid,u] of sessions) console.log(' ', sid.slice(0,8), String(u).slice(0,150));
console.log('EVENTS:\n' + events.join('\n'));
ws.close();
