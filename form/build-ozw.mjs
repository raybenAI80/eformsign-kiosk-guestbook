/** guestbook.ozr (PDF-backed, from-scratch) → guestbook.ozw (웹폼 디자이너 편집 가능)
 *
 *  방출 로직은 SDK 로 승격했다 — `eformsign-core` 의 `buildOzwFromPdfBacked(...)`
 *  (CLI `ozw build-from-pdf` · MCP `eformsign_build_ozw_from_pdf` 가 같은 구현의 얇은 어댑터다).
 *  이 스크립트는 방명록 전용 인자(필수 필드 목록·출력 경로)만 들고 SDK 를 호출한다.
 *  실행: node form/build-ozw.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildOzwFromPdfBacked } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');

const here = dirname(fileURLToPath(import.meta.url));
const REQUIRED_FIELD_IDS = ['방문일시', '방문자성명', '소속', '연락처', '방문목적', '담당자', '개인정보동의'];

const { buffer, tail, stats } = buildOzwFromPdfBacked({
  ozrBuffer: readFileSync(join(here, 'guestbook.ozr')),
  requiredFieldIds: REQUIRED_FIELD_IDS,
});

const outPath = join(here, 'guestbook.ozw');
writeFileSync(outPath, buffer);
writeFileSync(join(here, 'guestbook.tail.xml'), tail, 'utf8');
console.log(JSON.stringify({ outPath, ...stats }, null, 1));
