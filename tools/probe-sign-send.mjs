/** 이어서: 서명 패드 열기→그리기→확인→전송 까지. 현재 열려 있는 작성 화면 상태를 그대로 쓴다.
 *  node probe-sign-send.mjs --port 9233 --ev <dir>
 */
import fs from 'node:fs';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const PORT = arg('port', '9233');
const EV = arg('ev', 'D:/pjt/eformsign/kiosk-guestbook/evidence/final');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const t = targets.find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (m, p) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
await new Promise(r => ws.onopen = r);
const evalJs = async (e2) => { const r = await send('Runtime.evaluate', { expression: e2, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval'); return r.result.value; };
const click = async (x, y, wait = 1500) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); await sleep(wait); };
const drag = async (pts) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pts[0][0], y: pts[0][1] }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pts[0][0], y: pts[0][1], button: 'left', clickCount: 1 }); for (const [x, y] of pts.slice(1)) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' }); await sleep(25); } const l = pts[pts.length - 1]; await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: l[0], y: l[1], button: 'left', clickCount: 1 }); await sleep(500); };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(EV, { recursive: true }); fs.writeFileSync(`${EV}/${name}.png`, Buffer.from(r.data, 'base64')); console.log('  shot ' + name); };

await click(596, 675, 2500);            // 서명 영역
await shot('comp-06-signpad-open');
ws.close();
