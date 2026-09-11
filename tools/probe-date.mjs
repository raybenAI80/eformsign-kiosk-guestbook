/** 날짜 컴포넌트 오라클 — 새 작성 화면에서 (1) 오늘 자동입력 (2) 클릭 시 달력 팝업 을 캡처한다.
 *  node probe-date.mjs --port 9233 --ev <dir> [--base http://localhost:8099]
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
const evalJs = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval'); return r.result.value; };
const click = async (x, y, wait = 1200) => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); await sleep(wait); };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.mkdirSync(EV, { recursive: true }); fs.writeFileSync(`${EV}/${name}.png`, Buffer.from(r.data, 'base64')); console.log('  shot ' + name); };
const waitFor = async (expr, ms, label) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evalJs(expr)) return true; await sleep(500); } throw new Error('TIMEOUT ' + (label || expr)); };

await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });
await send('Page.enable', {});
await send('Page.navigate', { url: `${BASE}/?idle=0&mode=immediate` });
await sleep(3000);
await waitFor("window.__kioskState && window.__kioskState.phase === 'form'", 40000, 'phase=form');
await sleep(10000);
await shot('date-01-blank-form');
await click(38, 196);          // 전자문서 사용 동의
await click(708, 175, 11000);  // 계속
await shot('date-02-editable-today');

// OZ 뷰어에서 방문일시 컴포넌트 값 읽기(중첩 iframe 전수 탐색)
const readVal = `(function(){
  function dig(w, depth){
    var out=[];
    try{
      var d=w.document;
      var els=d.querySelectorAll('input');
      for(var i=0;i<els.length;i++){
        var e=els[i]; var v=e.value||'';
        if(/^\d{4}-\d{2}-\d{2}$/.test(v)) out.push({v:v, id:e.id||'', cls:e.className||''});
      }
      var fr=d.querySelectorAll('iframe');
      for(var j=0;j<fr.length && depth<4;j++){ try{ out=out.concat(dig(fr[j].contentWindow, depth+1)); }catch(err){} }
    }catch(err){}
    return out;
  }
  return JSON.stringify(dig(window,0));
})()`;
console.log('DATE_INPUTS=' + await evalJs(readVal));
ws.close();
