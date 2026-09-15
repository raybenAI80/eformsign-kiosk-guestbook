/** guestbook.html 을 실제로 렌더한 뒤 data-field 박스의 **PDF 좌표(pt)** 를 읽어
 *  layout.design.mjs 를 만든다. 디자인(HTML)이 좌표의 단일 진실 원천이 된다.
 *
 *  - 측정은 헤드리스 Chrome + CDP(Runtime.evaluate). Node 22 내장 WebSocket 만 쓰고
 *    외부 의존성은 없다(기존 form/*.mjs 와 같은 원칙).
 *  - CSS px → pt 변환은 96dpi 기준 ×0.75. 페이지는 A4 595.28×841.89pt.
 *  - 원점은 페이지 좌상단(= body 좌상단). @page margin:0 이라 둘이 일치한다.
 *  - 텍스트/서명 박스는 **테두리 안쪽**을 컴포넌트 bbox 로 잡는다(테두리를 덮지 않도록).
 *    라디오·체크박스는 글리프 크기가 작아 테두리 포함 박스를 그대로 쓴다.
 *
 *  사용: node form/design/extract-layout.mjs
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PX_TO_PT = 0.75;
const PAGE = { w: 595.28, h: 841.89 };

/** FORMID(= data-field) → OZR 필드 메타. build-ozr.mjs 의 FORM_IDS 와 짝이다. */
const FIELD_META = {
  방문일시:   { key: 'visit_datetime', id: 'visit_datetime', label: '방문 일시',   type: 'date',  todayDefault: true, group: 'rows' },
  방문자성명: { key: 'visitor_name',   id: 'visitor_name',   label: '방문자 성명', type: 'text',  group: 'rows' },
  소속:       { key: 'visitor_org',    id: 'visitor_org',    label: '소속',        type: 'text',  group: 'rows' },
  연락처:     { key: 'visitor_phone',  id: 'visitor_phone',  label: '연락처',      type: 'phone', group: 'rows' },
  방문목적:   { key: 'visit_purpose',  id: 'visit_purpose',  label: '방문 목적',   type: 'radio-group', group: 'purpose' },
  담당자:     { key: 'host_name',      id: 'host_name',      label: '만나는 담당자', type: 'text', group: 'host' },
  개인정보동의: { key: 'agree_privacy', id: 'agree_privacy',  label: '개인정보 수집·이용 동의', type: 'checkbox', group: 'consent' },
  방문자서명: { key: 'visitor_sign',   id: 'visitor_sign',   label: '방문자 서명', type: 'signature', group: 'sign' },
};

const r2 = (n) => Math.round(n * 100) / 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevTools(port, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch { /* 아직 안 떴다 */ }
    await sleep(150);
  }
  throw new Error('DevTools endpoint did not come up on port ' + port);
}

function cdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let seq = 0;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => {
        const id = ++seq;
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      close: () => ws.close(),
    }));
  });
}

/** 페이지 안에서 실행되는 측정 코드. 문자열로 넘긴다. */
const MEASURE = `(() => {
  const out = { fields: [], options: [], body: null };
  const b = document.body.getBoundingClientRect();
  out.body = { w: b.width, h: b.height, x: b.x, y: b.y };
  const inset = (el) => {
    const cs = getComputedStyle(el);
    return {
      t: parseFloat(cs.borderTopWidth) || 0,
      r: parseFloat(cs.borderRightWidth) || 0,
      bm: parseFloat(cs.borderBottomWidth) || 0,
      l: parseFloat(cs.borderLeftWidth) || 0,
    };
  };
  for (const el of document.querySelectorAll('[data-field]')) {
    const r = el.getBoundingClientRect();
    const isSmall = el.classList.contains('radio') || el.classList.contains('check');
    const i = isSmall ? { t: 0, r: 0, bm: 0, l: 0 } : inset(el);
    const rec = {
      field: el.dataset.field,
      option: el.dataset.option || null,
      cls: el.className,
      x0: r.left - b.left + i.l,
      y0: r.top - b.top + i.t,
      x1: r.right - b.left - i.r,
      y1: r.bottom - b.top - i.bm,
    };
    (rec.option ? out.options : out.fields).push(rec);
  }
  return JSON.stringify(out);
})()`;

const htmlPath = join(here, 'guestbook.html');
const fileUrl = 'file:///' + htmlPath.split(String.fromCharCode(92)).join('/');
const port = 9400 + Math.floor(Math.random() * 90);
const profile = mkdtempSync(join(tmpdir(), 'gblayout-'));

const child = execFile(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
  '--window-size=1200,1400',
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`,
  fileUrl,
], () => { /* 종료 콜백 무시 */ });

let raw;
try {
  const wsUrl = await waitForDevTools(port);
  const c = await cdp(wsUrl);
  await c.send('Page.enable');
  await sleep(500); // 폰트·이미지 반영
  const ev = await c.send('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
  if (ev.exceptionDetails) throw new Error('measure failed: ' + JSON.stringify(ev.exceptionDetails));
  raw = JSON.parse(ev.result.value);
  c.close();
} finally {
  child.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}

// ── px → pt ────────────────────────────────────────────────────────────────
const toPt = (r) => [r.x0, r.y0, r.x1, r.y1].map((v) => r2(v * PX_TO_PT));
const bodyPt = { w: r2(raw.body.w * PX_TO_PT), h: r2(raw.body.h * PX_TO_PT) };
if (Math.abs(bodyPt.w - PAGE.w) > 1 || Math.abs(bodyPt.h - PAGE.h) > 1) {
  throw new Error(`body 크기가 A4 가 아니다: ${bodyPt.w}x${bodyPt.h}pt`);
}

const byField = new Map(raw.fields.map((f) => [f.field, toPt(f)]));
const missing = Object.keys(FIELD_META).filter((k) => k !== '방문목적' && !byField.has(k));
if (missing.length) throw new Error('data-field 누락: ' + missing.join(', '));

// 라디오 옵션
const opts = raw.options.filter((o) => o.field === '방문목적').map((o) => ({ label: o.option, box: toPt(o) }));
if (opts.length !== 5) throw new Error(`방문목적 옵션이 5개가 아니다: ${opts.length}`);
opts.sort((a, b) => a.box[0] - b.box[0]);
const tops = new Set(opts.map((o) => o.box[1]));
const sizes = new Set(opts.map((o) => r2(o.box[2] - o.box[0])));
const hs = new Set(opts.map((o) => r2(o.box[3] - o.box[1])));
if (tops.size !== 1) throw new Error('라디오 옵션의 top 이 서로 다르다: ' + [...tops].join(','));
if (sizes.size !== 1 || hs.size !== 1 || [...sizes][0] !== [...hs][0]) {
  throw new Error('라디오 옵션이 정사각형·동일 크기가 아니다');
}
const boxTop = [...tops][0];
const size = [...sizes][0];

// ── layout.design.mjs 방출 ─────────────────────────────────────────────────
const rowIds = ['방문일시', '방문자성명', '소속', '연락처'];
const j = (a) => `[${a.join(', ')}]`;
const rowLine = (fid) => {
  const m = FIELD_META[fid];
  const extra = m.todayDefault ? ', todayDefault: true' : '';
  return `  { id: '${m.id}', label: '${m.label}', formId: '${fid}', type: '${m.type}', required: true${extra}, box: ${j(byField.get(fid))} },`;
};

const src = `/** 방문자 기록부 — 디자인 HTML(guestbook.html)에서 **자동 추출**한 좌표.
 *  🔴 손으로 고치지 말 것. guestbook.html 을 고친 뒤
 *     \`node form/design/render-pdf.mjs && node form/design/extract-layout.mjs\` 로 다시 만든다.
 *  좌표 단위 = PDF 포인트(pt), 원점 = 페이지 좌상단. A4 세로 1장.
 *  스키마는 form/layout.mjs 와 호환된다(build-ozr.mjs 가 쓰는 표면 그대로).
 *  생성 시각: ${new Date().toISOString()}
 */
export const SOURCE = 'form/design/guestbook.html';
export const PAGE = { w: ${PAGE.w}, h: ${PAGE.h} };
export const M = { left: 52, right: 543.28 };
export const LABEL_X = 52;
export const LABEL_W = 96;
export const VALUE_X = ${byField.get('방문자성명')[0]};

export const rows = [
${rowIds.map(rowLine).join('\n')}
];

export const purpose = {
  id: 'visit_purpose', label: '방문 목적', formId: '방문목적', required: true,
  boxTop: ${boxTop}, size: ${size},
  options: [
${opts.map((o) => `    { label: '${o.label}', x: ${o.box[0]}, box: ${j(o.box)} },`).join('\n')}
  ],
};

export const host = { id: 'host_name', label: '만나는 담당자', formId: '담당자', type: 'text', required: true, box: ${j(byField.get('담당자'))} };

export const consent = {
  heading: '개인정보 수집·이용 동의',
  checkId: 'agree_privacy',
  checkFormId: '개인정보동의',
  checkLabel: '위 내용을 확인하였으며 개인정보 수집·이용에 동의합니다. (필수)',
  checkBox: ${j(byField.get('개인정보동의'))},
};

export const sign = { id: 'visitor_sign', label: '방문자 서명', formId: '방문자서명', box: ${j(byField.get('방문자서명'))} };

export const footer = { text: '작성해 주셔서 감사합니다. 전송을 누르면 다음 방문자용 화면이 다시 열립니다.' };

/** 입력 컴포넌트 bbox. 디자인에서 실측한 값이므로 그대로 돌려준다.
 *  (form/layout.mjs 의 inputBox(r) 와 같은 호출 규약) */
export const inputBox = (r) => r.box;
`;

const outPath = join(here, 'layout.design.mjs');
writeFileSync(outPath, src, 'utf8');

const table = [
  ...rowIds.map((f) => ({ formId: f, kind: FIELD_META[f].type, box: byField.get(f) })),
  ...opts.map((o) => ({ formId: '방문목적/' + o.label, kind: 'radio-option', box: o.box })),
  { formId: '담당자', kind: 'text', box: byField.get('담당자') },
  { formId: '개인정보동의', kind: 'checkbox', box: byField.get('개인정보동의') },
  { formId: '방문자서명', kind: 'signature', box: byField.get('방문자서명') },
];
writeFileSync(join(here, 'layout.design.json'), JSON.stringify({ page: PAGE, fields: table }, null, 1), 'utf8');
console.log(JSON.stringify({ out: outPath, page: bodyPt, count: table.length, fields: table }, null, 1));
