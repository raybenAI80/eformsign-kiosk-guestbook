/** 템플릿별 생성 문서 일람. 기본은 type:"04"(템플릿별), --type 으로 01/02/04 선택.
 *  node --env-file=... tools/list-docs.mjs <templateId...> [--type 04] [--page-size 100]
 *  외부 작성자 문서는 type:"01"(내 문서함)에 나오지 않는다.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const type = arg('type', '04');
const pageSize = Number(arg('page-size', '100'));
const templateIds = process.argv.slice(2).filter((x) => /^[0-9a-f]{32}$/.test(x));

const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const memberId = process.env.EFORMSIGN_DEFAULT_MEMBER_ID;

const fmt = (ms) => (ms ? new Date(Number(ms)).toISOString().replace('T', ' ').slice(0, 19) : '');

const rows = [];
for (let page = 0; page < 20; page += 1) {
  const q = { type, pageSize, page, memberId };
  if (templateIds.length && type === '04') q.templateIds = templateIds;
  const r = await client.documents.list(q);
  const docs = r.documents || r.items || r.list || [];
  if (!docs.length) break;
  rows.push(...docs);
  if (docs.length < pageSize) break;
}

const filtered = templateIds.length ? rows.filter((d) => templateIds.includes(d.template?.id)) : rows;
filtered.sort((a, b) => (a.created_date || 0) - (b.created_date || 0));
console.log(`type=${type} 총 ${filtered.length}건 (수신 ${rows.length}건)`);
console.log('생성시각(UTC)         | 상태   | 문서 ID                          | 문서명');
for (const d of filtered) {
  const status = (d.current_status && d.current_status.step_name) || d.current_status?.status_type || '';
  console.log(`${fmt(d.created_date || d.create_date)} | ${String(status).padEnd(6)} | ${d.id || d.document_id} | ${d.document_name}`);
}
