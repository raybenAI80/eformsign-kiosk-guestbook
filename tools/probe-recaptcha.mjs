/** reCAPTCHA ON 상태에서 전송 확인 팝업에 "로봇이 아닙니다" 체크가 붙는지 캡처. 체크는 하지 않는다. */
import fs from 'node:fs';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const PORT = arg('port', '9233'); const BASE = arg('base', 'http://localhost:8099');
const EV = arg('ev', 'D:/pjt/eformsign/kiosk-guestbook/evidence/final');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const t = targets.find(x => x.type === 'page'); const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (m, p) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
await new Promise(r => ws.onopen = r);
const evalJs = async (e2) => { const r = await send('Runtime.evaluate', { expression: e2, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval'); return r.result.value; };
const click = async (x, y, w = 1500) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); await sleep(w); };
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(EV, { recursive: true }); fs.writeFileSync(`${EV}/${n}.png`, Buffer.from(r.data, 'base64')); console.log('  shot ' + n); };
const waitFor = async (e2, ms, l) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evalJs(e2)) return true; await sleep(500); } throw new Error('TIMEOUT ' + l); };

await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });
await send('Page.enable', {});
await send('Page.navigate', { url: `${BASE}/?idle=0&mode=immediate&v=rc` });
await sleep(3000);
await waitFor("window.__kioskState && window.__kioskState.phase === 'form'", 40000, 'phase=form');
await sleep(11000);
await click(38, 196); await click(708, 175, 11000);
await click(686, 973, 6000);   // 전송
await shot('recaptcha-01-send-popup');
console.log('NOTE: 체크박스는 누르지 않음 (CAPTCHA 통과 금지)');
ws.close();
