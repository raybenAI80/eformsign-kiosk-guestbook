/** 2026-09-16 정리 — 테스트 문서 4건 + 실험/폐기 템플릿 3건 삭제. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');

const DOCS = ['ca4199dd93014820abad35b629b6396b','737b8567a61646338c6fb331caaaf8ae',
              'fc06f1b932b241e2aed618fe76495af2','1f948e84c9ce4a75895af361b18fa197'];
const TPLS = ['c9f7a7de51bf426e910f13883180eb46','9f811e9bd2b44bb0aca8782b0b8c1223',
              '283210e59ebe4156af5707effd2067b0'];
const PROTECT = new Set([
  // 보존 문서
  'b99395ad14504a11a58876fa6c17413b','3797248806c8464f8e09cb07f4822ccd','d1cc210f0b94416bb8cf90a28426041c',
  '29439d7b5e244f6d8a7d1dc805bb29ad','9fffd6a2c6594f3f8690ae9f4fa0fbca','0dec68d3de634032b51af29cbbccdfb5',
  '8b2ce3f90996410a854414420ff85308','fef940a42d024f15acc6d23b894b6fd1',
  // 보존 템플릿
  '8844aae609b84078a59ef3118c64dab2','31de7ab146d14f2bb923d7a94d7122e5','9ee8126bcf4248a68d966a8b56759e6d',
  'bf35f6c28c7945a48a9668fb00711466','e1fef806750248d5993c2ecee84e9502','e86be31eb2e3485184b94d3d58540095',
  'ba4b17d0645c4ff2818db451eda38977','6365dcf14e7b4265b4cbb98e7c7c4b8f','f7542d23f2e141228ce14604e1874747',
  '0c0a8338ca714a0bab4fc50af562a538','684511a337bf40459d5ea55f330731b1',
]);
const bad = [...DOCS, ...TPLS].filter((id) => PROTECT.has(id));
if (bad.length) { console.error('PROTECT 충돌 — 중단', bad); process.exit(1); }
console.log('PROTECT 충돌 0건 — 실행');

const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const memberId = process.env.EFORMSIGN_DEFAULT_MEMBER_ID;

for (const id of DOCS) {
  try { const r = await client.documents.delete({ documentIds: [id], memberId }); console.log('DOC OK  ', id, JSON.stringify(r).slice(0, 100)); }
  catch (e) { console.log('DOC ERR ', id, String(e).slice(0, 160)); }
}
for (const id of TPLS) {
  try { const r = await client.templates.delete(id); console.log('TPL OK  ', id, JSON.stringify(r).slice(0, 100)); }
  catch (e) { console.log('TPL ERR ', id, String(e).slice(0, 160)); }
}
