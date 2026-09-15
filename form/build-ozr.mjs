/** layout.mjs + guestbook.pdf → 방문자 기록부 OZR (PDF-backed, from-scratch). */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as L from './layout.mjs';

const require = createRequire(import.meta.url);
const { buildPdfBackedOzr } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');
const here = dirname(fileURLToPath(import.meta.url));
const pdf = readFileSync(join(here, 'guestbook.pdf'));

const FORM_IDS = {
  visit_datetime: '방문일시',
  visitor_name: '방문자성명',
  visitor_org: '소속',
  visitor_phone: '연락처',
  visit_purpose: '방문목적',
  host_name: '담당자',
  agree_privacy: '개인정보동의',
  visitor_sign: '방문자서명',
};

const fields = [];
for (const r of [...L.rows, L.host]) {
  fields.push({ id: r.id, label: r.label, page: 1, bbox: L.inputBox(r), type: r.type, todayDefault: r.todayDefault === true });
}
fields.push({
  id: L.purpose.id, label: L.purpose.label, page: 1, type: 'radio-group',
  bbox: [L.purpose.options[0].x, L.purpose.boxTop, L.purpose.options.at(-1).x + L.purpose.size, L.purpose.boxTop + L.purpose.size],
  options: L.purpose.options.map((o) => ({ label: o.label, bbox: [o.x, L.purpose.boxTop, o.x + L.purpose.size, L.purpose.boxTop + L.purpose.size] })),
});
fields.push({ id: L.consent.checkId, label: '개인정보 수집·이용 동의', page: 1, type: 'checkbox', bbox: L.consent.checkBox });
fields.push({ id: L.sign.id, label: L.sign.label, page: 1, type: 'signature', bbox: L.sign.box });

const result = await buildPdfBackedOzr({
  pdf,
  pageCount: 1,
  sectionName: '방문자 기록부',
  fields,
  formIds: FORM_IDS,
  pageWidth: 595,
  pageHeight: 842,
  required: [
    { formId: '방문일시' }, { formId: '방문자성명' }, { formId: '소속' }, { formId: '연락처' },
    { formId: '방문목적', kind: 'radio' }, { formId: '담당자' },
    { formId: '개인정보동의', kind: 'radio' },
  ],
  outputPath: join(here, 'guestbook.ozr'),
  xmlPath: join(here, 'guestbook.report.xml'),
  layoutAudit: { reportPath: join(here, 'layout-audit.json'), label: '방문자기록부', required: true },
});

writeFileSync(join(here, 'build-stats.json'), JSON.stringify({
  stats: result.stats, coverage: result.coverage, clipped: result.clipped,
  formIds: result.formIds, layoutAudit: { ran: result.layoutAudit.ran, status: result.layoutAudit.status },
}, null, 1));
console.log(JSON.stringify({ stats: result.stats, coverage: result.coverage, audit: result.layoutAudit.status, skipped: result.layoutAudit.skipped }, null, 1));
