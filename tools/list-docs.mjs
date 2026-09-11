/** 템플릿별 생성 문서 일람. 기본은 type:"04"(문서 관리 — 관리자용 전체 목록).
 *  node --env-file=... tools/list-docs.mjs <templateId...> [--type 04] [--limit 100] [--all]
 *
 *  type 코드(API 가이드 Box type 표 + 2026-09-11 전수 실측):
 *    01 진행 중 / 02 처리 할 / 03 완료 / 04 문서 목록(문서 관리)
 *  🔴 외부 URL 작성자(키오스크) 문서는 개인 문서함 01/02/03 어디에도 안 잡히고 04 에만 있다.
 *
 *  🔴 2026-09-11 페이징 버그 수정 — SDK `documents.list` 가 받는 이름은 `limit`/`skip` 이다.
 *  종전 코드는 `pageSize`/`page` 를 넘겼고 SDK 가 **조용히 무시**해 언제나 기본값(limit 20,
 *  skip 0)으로만 조회됐다("수신 20건"이 그 증상). 문서가 20건을 넘는 판정이 통째로 틀어진다.
 *  `--all` 은 더 받을 게 없을 때까지 skip 을 올리며 전수 조회한다(기본 동작도 이제 전수다).
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const type = arg('type', '04');
// --page-size 는 옛 이름이라 그대로 받아 준다(호출부 호환). 실제로 SDK 에 넘기는 이름은 limit 이다.
const limit = Number(arg('limit', arg('page-size', '100')));
const MAX_PAGES = process.argv.includes('--all') ? 1000 : 20;
const templateIds = process.argv.slice(2).filter((x) => /^[0-9a-f]{32}$/.test(x));

const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const memberId = process.env.EFORMSIGN_DEFAULT_MEMBER_ID;

const fmt = (ms) => (ms ? new Date(Number(ms)).toISOString().replace('T', ' ').slice(0, 19) : '');

const rows = [];
for (let page = 0; page < MAX_PAGES; page += 1) {
  // 🔴 limit/skip 이 SDK 가 읽는 유일한 이름이다. pageSize/page 는 무시된다.
  const q = { type, limit, skip: page * limit, memberId };
  if (templateIds.length && type === '04') q.templateIds = templateIds;
  const r = await client.documents.list(q);
  const docs = r.documents || r.items || r.list || [];
  if (!docs.length) break;
  rows.push(...docs);
  if (docs.length < limit) break;
}

const filtered = templateIds.length ? rows.filter((d) => templateIds.includes(d.template?.id)) : rows;
filtered.sort((a, b) => (a.created_date || 0) - (b.created_date || 0));
console.log(`type=${type} 총 ${filtered.length}건 (수신 ${rows.length}건)`);
console.log('생성시각(UTC)         | 상태   | 문서 ID                          | 문서명');
for (const d of filtered) {
  const status = (d.current_status && d.current_status.step_name) || d.current_status?.status_type || '';
  console.log(`${fmt(d.created_date || d.create_date)} | ${String(status).padEnd(6)} | ${d.id || d.document_id} | ${d.document_name}`);
}
