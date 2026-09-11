/** 서식 필드 바인딩 오라클 — API 로 값이 들어간 완료 문서를 1건 만들고 완료 PDF 를 내려받는다.
 *  브라우저 입력 경로와 무관하게 "값이 서식의 제자리에 인쇄되는가"를 판정한다.
 *  node --env-file=... binding-probe.mjs --form <id> --out <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const FORM = arg('form'); const OUT = arg('out', 'D:/pjt/eformsign/kiosk-guestbook/evidence/final');
const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const MEMBER = process.env.EFORMSIGN_DEFAULT_MEMBER_ID;
const fields = [
  { id: '방문일시', value: '2026-09-11' },
  { id: '방문자성명', value: '홍길동' },
  { id: '소속', value: '가나다 주식회사' },
  { id: '연락처', value: '010-1234-5678' },
  { id: '방문목적', value: '회의' },
  { id: '담당자', value: '김담당' },
  { id: '개인정보동의', value: 'Y' },
];
const sigB64 = readFileSync('D:/pjt/eformsign/kiosk-guestbook/form/signature-sample.png').toString('base64');
const SIG_FORMS = (arg('sig', 'datauri') === 'raw')
  ? [{ id: '방문자서명', value: sigB64 }]
  : [{ id: '방문자서명', value: 'data:image/png;base64,' + sigB64 }];
fields.push(...SIG_FORMS);
const created = await client.documents.create(FORM, {
  document: { document_name: '[바인딩 오라클] 방문자 기록부 ' + Date.now(), fields, recipients: [{ step_type: '01' }], comment: '검증 전용' },
}, { memberId: MEMBER });
const id = created?.document?.id;
console.log('document', id);
let status = '';
for (let i = 0; i < 20; i += 1) {
  const g = await client.documents.get(id, { memberId: MEMBER });
  status = g?.document?.document_status?.code ?? g?.document_status?.code ?? JSON.stringify(g).slice(0, 80);
  if (String(status) === '003' || String(status) === 'completed') break;
  await new Promise((r) => setTimeout(r, 2000));
}
console.log('status', status);
const pdf = await client.documents.downloadFiles(id, { memberId: MEMBER });
mkdirSync(OUT, { recursive: true });
const buf = pdf.buffer ?? pdf;
writeFileSync(`${OUT}/binding-${id}.pdf`, buf);
console.log('pdf', `${OUT}/binding-${id}.pdf`, buf.length, 'bytes');
