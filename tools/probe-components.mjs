/** 컴포넌트 어포던스 오라클 — 달력 팝업/라디오/체크/서명패드 UI 를 순서대로 캡처한다.
 *  node probe-components.mjs --port 9233 --ev <dir>
 */
import fs from 'node:fs';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const PORT = arg('port', '9233');
const BASE = arg('base', 'http://localhost:8099');
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
const drag = async (pts) => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pts[0][0], y: pts[0][1], button: 'left', clickCount: 1 }); for (const [x, y] of pts.slice(1)) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' }); await sleep(30); } const last = pts[pts.length - 1]; await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: last[0], y: last[1], button: 'left', clickCount: 1 }); await sleep(600); };
const type = async (s) => { for (const ch of s) await send('Input.insertText', { text: ch }); };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(EV, { recursive: true }); fs.writeFileSync(`${EV}/${name}.png`, Buffer.from(r.data, 'base64')); console.log('  shot ' + name); };
const waitFor = async (e2, ms, l) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evalJs(e2)) return true; await sleep(500); } throw new Error('TIMEOUT ' + (l || e2)); };

await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });
await send('Page.enable', {});
await send('Page.navigate', { url: `${BASE}/?idle=0&mode=immediate` });
await sleep(3000);
await waitFor("window.__kioskState && window.__kioskState.phase === 'form'", 40000, 'phase=form');
await sleep(10000);
await click(38, 196);
await click(708, 175, 11000);
await shot('comp-00-editable');

// 1) 날짜 필드 클릭 → 달력 팝업
await click(410, 411, 2500);
await shot('comp-01-date-calendar');
await send('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: 27, key: 'Escape' });
await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 27, key: 'Escape' });
await sleep(800);

// 2) 텍스트 3종
await click(480, 464, 900); await type('홍길동'); await sleep(400);
await click(520, 518, 900); await type('포시에스'); await sleep(400);
await click(470, 571, 900); await type('010-1234-5678'); await sleep(400);
await shot('comp-02-text-filled');

// 3) 라디오(방문 목적) — '회의'
await click(342, 624, 1500);
await shot('comp-03-radio-selected');

// 4) 담당자
await click(500, 678, 900); await type('김담당'); await sleep(400);

// 5) 체크박스(동의)
await click(195, 870, 1500);
await shot('comp-04-check-agreed');

// 6) 서명 패드 — 아래로 스크롤 후 클릭
await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 400, y: 600, deltaX: 0, deltaY: 300 });
await sleep(1500);
await shot('comp-05-scrolled');
