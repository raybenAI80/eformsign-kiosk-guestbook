import fs from 'node:fs';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const PORT = arg('port', '9233'); const EV = arg('ev', 'D:/pjt/eformsign/kiosk-guestbook/evidence/final');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const t = targets.find(x => x.type === 'page'); const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (m, p) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
await new Promise(r => ws.onopen = r);
const evalJs = async (e2) => { const r = await send('Runtime.evaluate', { expression: e2, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval'); return r.result.value; };
const click = async (x, y, w = 1500) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); await sleep(w); };
const drag = async (pts) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pts[0][0], y: pts[0][1] }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pts[0][0], y: pts[0][1], button: 'left', clickCount: 1 }); for (const [x, y] of pts.slice(1)) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' }); await sleep(20); } const l = pts.at(-1); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: l[0], y: l[1], button: 'left', clickCount: 1 }); await sleep(400); };
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(EV, { recursive: true }); fs.writeFileSync(`${EV}/${n}.png`, Buffer.from(r.data, 'base64')); console.log('  shot ' + n); };
const waitFor = async (e2, ms, l) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evalJs(e2)) return true; await sleep(500); } throw new Error('TIMEOUT ' + l); };

// 서명 그리기
const pts = []; for (let i = 0; i <= 40; i++) { const x = 120 + i * 13; const y = 560 + Math.sin(i / 3) * 70; pts.push([Math.round(x), Math.round(y)]); }
await drag(pts);
await shot('comp-07-signpad-drawn');
await click(700, 885, 2500);   // 확인
await shot('comp-08-sign-applied');

const before = await evalJs('window.__kioskState.submits');
await click(686, 989, 6000);   // 전송
await shot('comp-09-send-popup');
await click(606, 639, 3000);
if (!(await evalJs(`window.__kioskState.submits > ${before}`))) await click(606, 716, 4000);
await waitFor(`window.__kioskState.submits > ${before}`, 60000, '제출');
console.log('DOCS=' + await evalJs('JSON.stringify(window.__kioskState.docs)'));
await sleep(3000); await shot('comp-10-after-submit');
ws.close();
