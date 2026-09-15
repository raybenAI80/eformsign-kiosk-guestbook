#!/usr/bin/env node
/**
 * designer-observe — 웹폼 디자이너(create_form.html?...&type=modify) 로드를 CDP 로 관찰한다.
 * 네트워크 전수 + 관심 URL 응답 본문 + 콘솔 + 예외 + 페이지/iframe 전역 프로브를 JSON 한 덩어리로 저장.
 *
 * 왜 이 도구가 필요한가 (2026-09-15): 손수 방출한 .ozw 가 서버·작성·제출·완료 PDF 를 전부 통과하면서
 * 웹폼 디자이너에서만 빈 캔버스로 열렸다. 에러 팝업도 콘솔 예외도 없다 — 디자이너의 codec 이 실패를
 * 조용히 흡수한다. 그래서 "열렸다/안 열렸다" 는 화면이 아니라 **전역 상태 수치**로 판정해야 한다:
 *   #contentFrame.contentWindow.__DesignerView__.m_pViewPageArray.length   >= 1   (배경 페이지)
 *   #contentFrame.contentWindow.__DesignerFrame__.m_pCompManager.m_nCompCount == 스펙 필드 수
 * 이 두 값이 게이트 ozw-designer-open 의 기계 프로브다.
 *
 * 사용:
 *   # 캡처 Chrome 기동 (대상 템플릿 소유 계정으로 로그인돼 있어야 한다)
 *   chrome.exe --remote-debugging-port=9223 --user-data-dir=D:\pjt\eformsign\.chrome-capture
 *   CDP_PORT=9223 node kiosk-guestbook/tools/designer-observe.mjs  *     "https://www.eformsign.com/eform/form/create_form.html?form_id=<ID>&type=modify&menu=general" out.json 25000
 *
 * 🔴 &type=modify 가 없으면 form_id 를 무시하고 "템플릿 생성/파일 업로드" 화면으로 떨어진다 — 빈 캔버스와 혼동 금지.
 * 🔴 로그인 화면이 나오면 중단한다(자격증명 처리 금지). 계정이 다르면 ozr_download 가 400 인데 그건 결함 재현이 아니라 권한 불일치다.
 *
 * 승격 이력: docs/research/shots-ozw-designer-2026-09-15/cdp-observe.mjs (일회성 조사 스크립트) → 이 경로.
 */
import fs from 'node:fs';

const PORT = process.env.CDP_PORT || 9223;
const HOST = '127.0.0.1';
const url = process.argv[2];
const out = process.argv[3];
const waitMs = Number(process.argv[4] || 18000);

const list = await (await fetch(`http://${HOST}:${PORT}/json/list`)).json();
const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
if (!page) { console.error('no page target'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
const sessions = new Set();
const bodies = [];

function send(method, params = {}, sessionId) {
  const msgId = ++id;
  return new Promise((res, rej) => {
    pending.set(msgId, { res, rej });
    ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

await new Promise(r => ws.addEventListener('open', r));
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    if (m.error) rej(new Error(m.error.message)); else res(m.result);
    return;
  }
  if (m.method) {
    events.push({ sessionId: m.sessionId || null, method: m.method, params: m.params });
    if (m.method === 'Network.responseReceived' && (m.params.response.status >= 400 || /ozr_download|\/ozrs\/|include_config=Y/.test(m.params.response.url))) {
      const rid = m.params.requestId, sid = m.sessionId;
      setTimeout(() => {
        send('Network.getResponseBody', { requestId: rid }, sid)
          .then(r => bodies.push({ url: m.params.response.url, status: m.params.response.status, body: String(r.body) }))
          .catch(e => bodies.push({ url: m.params.response.url, status: m.params.response.status, body: 'ERR ' + e.message }));
      }, 800);
    }
    if (m.method === 'Target.attachedToTarget') {
      const sid = m.params.sessionId;
      sessions.add(sid);
      send('Network.enable', {}, sid).catch(() => {});
      send('Log.enable', {}, sid).catch(() => {});
      send('Runtime.enable', {}, sid).catch(() => {});
      send('Page.enable', {}, sid).catch(() => {});
      send('Runtime.runIfWaitingForDebugger', {}, sid).catch(() => {});
    }
  }
});

await send('Network.enable');
await send('Log.enable');
await send('Runtime.enable');
await send('Page.enable');
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });

if (url.startsWith('click:')) {
  await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(url.slice(6))}).click()` });
} else {
  await send('Page.navigate', { url });
}
await new Promise(r => setTimeout(r, waitMs));

// 네트워크 요약
const reqs = new Map();
for (const e of events) {
  const p = e.params || {};
  if (e.method === 'Network.requestWillBeSent') {
    reqs.set(p.requestId, { url: p.request.url, method: p.request.method, type: p.type, status: null, mime: null, len: null, failed: null, fromCache: false });
  } else if (e.method === 'Network.responseReceived') {
    const r = reqs.get(p.requestId); if (r) { r.status = p.response.status; r.mime = p.response.mimeType; r.type = p.type; r.fromCache = !!p.response.fromDiskCache; }
  } else if (e.method === 'Network.loadingFinished') {
    const r = reqs.get(p.requestId); if (r) r.len = p.encodedDataLength;
  } else if (e.method === 'Network.loadingFailed') {
    const r = reqs.get(p.requestId); if (r) { r.failed = p.errorText + (p.blockedReason ? ' /' + p.blockedReason : ''); }
  }
}

const logs = events.filter(e => e.method === 'Log.entryAdded').map(e => ({
  level: e.params.entry.level, text: e.params.entry.text, url: e.params.entry.url, line: e.params.entry.lineNumber,
}));
const consoleApi = events.filter(e => e.method === 'Runtime.consoleAPICalled').map(e => ({
  type: e.params.type, args: (e.params.args || []).map(a => a.value ?? a.description ?? a.type).slice(0, 6),
}));
const exceptions = events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => ({
  text: e.params.exceptionDetails.text,
  desc: e.params.exceptionDetails.exception?.description,
  url: e.params.exceptionDetails.url, line: e.params.exceptionDetails.lineNumber,
}));

const probeExpr = `(() => {
  const out = { href: location.href, title: document.title };
  const keys = Object.keys(window).filter(k => /page|comp|form|ozw|ozr|doc|design|viewer|oz/i.test(k));
  out.globalKeys = keys.slice(0, 200);
  out.summary = {};
  for (const k of keys) {
    try {
      const v = window[k];
      if (v == null) { out.summary[k] = String(v); continue; }
      if (Array.isArray(v)) out.summary[k] = 'Array(' + v.length + ')';
      else if (typeof v === 'object') out.summary[k] = 'obj{' + Object.keys(v).slice(0,25).join(',') + '}';
      else if (typeof v === 'function') out.summary[k] = 'fn';
      else out.summary[k] = typeof v + ':' + String(v).slice(0, 120);
    } catch (e) { out.summary[k] = 'ERR ' + e.message; }
  }
  out.iframes = [...document.querySelectorAll('iframe')].map(f => ({ id: f.id, name: f.name, src: f.src, w: f.clientWidth, h: f.clientHeight }));
  out.bodyTextHead = (document.body.innerText || '').slice(0, 1200);
  return JSON.stringify(out);
})()`;

let probe = null;
try {
  const r = await send('Runtime.evaluate', { expression: probeExpr, returnByValue: true, awaitPromise: false });
  probe = r.result?.value ? JSON.parse(r.result.value) : r;
} catch (e) { probe = { error: e.message }; }

// 자식 세션(iframe target)들도 probe
const framesProbe = [];
for (const sid of sessions) {
  try {
    const r = await send('Runtime.evaluate', { expression: probeExpr, returnByValue: true }, sid);
    if (r.result?.value) framesProbe.push(JSON.parse(r.result.value));
  } catch { /* ignore */ }
}

fs.writeFileSync(out, JSON.stringify({
  url, requests: [...reqs.values()], bodies, logs, consoleApi, exceptions, probe, framesProbe,
  sessionCount: sessions.size,
}, null, 2));
console.log('saved', out, 'requests', reqs.size, 'logs', logs.length, 'exceptions', exceptions.length);
ws.close();
process.exit(0);
