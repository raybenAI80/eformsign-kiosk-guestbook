/** 전 항목(날짜·텍스트4·라디오·체크·서명) 채우고 제출 — 완료 PDF 렌더 증거용 문서 1건 생성.
 *  node tools/probe-full-submit.mjs --port 9233 [--base http://localhost:8099]
 *  좌표는 768x1024 태블릿 뷰포트 기준(probe-components / probe-sign2 에서 채취).
 */
import fs from 'node:fs';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const PORT = arg('port', '9233');
const BASE = arg('base', 'http://localhost:8099');
const EV = arg('ev', 'D:/pjt/eformsign/kiosk-guestbook/evidence/ozw-v3');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const t = targets.find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (m, p) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
await new Promise((r) => { ws.onopen = r; });
const evalJs = async (x) => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval'); return r.result.value; };
const click = async (x, y, w = 1500) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); await sleep(w); };
const drag = async (pts) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pts[0][0], y: pts[0][1] }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pts[0][0], y: pts[0][1], button: 'left', clickCount: 1 }); for (const [x, y] of pts.slice(1)) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left' }); await sleep(20); } const l = pts.at(-1); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: l[0], y: l[1], button: 'left', clickCount: 1 }); await sleep(500); };
const type = async (s) => { for (const ch of s) await send('Input.insertText', { text: ch }); };
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(EV, { recursive: true }); fs.writeFileSync(`${EV}/${n}.png`, Buffer.from(r.data, 'base64')); console.log('  shot ' + n); };
const waitFor = async (x, ms, label) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evalJs(x)) return true; await sleep(500); } throw new Error('TIMEOUT ' + (label || x)); };

await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });
await send('Page.enable', {});
await send('Page.navigate', { url: `${BASE}/?idle=0&mode=immediate` });
await sleep(3000);
await waitFor("window.__kioskState && window.__kioskState.phase === 'form'", 40000, 'phase=form');
await sleep(10000);
await click(38, 196);              // 전자문서 사용 동의
await click(708, 175, 11000);      // 계속
await shot('full-00-editable');
await click(480, 464, 900); await type('오즈더블유');
await click(520, 518, 900); await type('포시에스');
await click(470, 571, 900); await type('010-1234-5678');
await click(342, 624, 1500);       // 방문 목적 라디오
await click(500, 678, 900); await type('김담당');
await click(195, 870, 1500);       // 개인정보 동의 체크
await shot('full-01-filled');
await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 400, y: 600, deltaX: 0, deltaY: 300 });
await sleep(1200);
await click(596, 675, 2500);       // 서명 영역
await shot('full-02-signpad');
await drag([[300, 500], [340, 470], [380, 520], [420, 470], [460, 510], [500, 480]]);
await shot('full-03-signed');
await click(700, 885, 2500);       // 확인
await shot('full-04-sign-applied');
const before = await evalJs('window.__kioskState.submits');
await click(686, 989, 6000);       // 전송
await shot('full-05-send-popup');
await click(606, 639, 3000);
if (!(await evalJs(`window.__kioskState.submits > ${before}`))) await click(606, 716, 4000);
await waitFor(`window.__kioskState.submits > ${before}`, 60000, '제출 감지');
const docs = await evalJs('JSON.stringify(window.__kioskState.docs)');
const log = await evalJs('window.__kioskLog.filter(l=>l.includes("saveSuccess")).slice(-1)[0] || ""');
console.log('DOCS ' + docs);
console.log('LOG ' + log);
ws.close();
