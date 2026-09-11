/**
 * 방명록 키오스크 테스트 템플릿 만들기.
 *
 * 하는 일: 소스 템플릿의 OZR 을 그대로 받아 새 템플릿으로 재배포한 뒤,
 *          auth.external_users.use_external_users(=「URL로 문서 생성 허용」) 를 켜고 release 한다.
 *
 * 실행: node --env-file=D:/pjt/eformsign/eformsign-core/.env make-kiosk-template.mjs [--source <formId>] [--name <이름>]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient, toCreateShapeAuth } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const SOURCE = arg('source', 'f7542d23f2e141228ce14604e1874747');
const NAME = arg('name', '방명록-키오스크-테스트');
const EXISTING = arg('form', '');

const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const http = client.templates.opts.http;
const member = process.env.EFORMSIGN_DEFAULT_MEMBER_ID;
const tokenKind = { member };
const company = await http.getCompany();
const cid = company.id;
const enc = encodeURIComponent(member);

const getForm = async (fid) => (await http.requestService(
  `/v1.0/companies/${cid}/members/${enc}/forms/${fid}`, { method: 'GET', tokenKind, query: { lang: 'ko' } }
))?.result?.form;

console.log('company', cid, 'member', member);

let re;
if (EXISTING) { re = { newFormId: EXISTING, copiedConfigKeys: ['(skipped)'] }; }
else {
// 1) 소스 OZR 내려받기
const dl = await client.templates.downloadOzw(SOURCE, { memberId: member });
console.log('downloaded', dl.filename, dl.buffer.length, 'bytes');

// 2) 새 템플릿으로 재배포(config 복사 + release)
re = await client.templates.redeployOzr({
  sourceFormId: SOURCE,
  name: NAME,
  abbreviation: NAME,
  category: '키오스크',
  description: '방명록 키오스크 실기 검증용. URL로 문서 생성 허용 ON.',
  memberId: member,
  file: { filename: NAME + '.ozr', data: dl.buffer },
  release: true,
});
}
console.log('new form', re.newFormId, 'copied', re.copiedConfigKeys, re.configWarning || '');

// 3) 「URL로 문서 생성 허용」 ON + reCAPTCHA ON
const nf = await getForm(re.newFormId);
nf.auth = toCreateShapeAuth(nf.auth);
nf.auth.external_users.use_external_users = true;
nf.auth.external_users.use_recaptcha = true;          // 봇 대량 생성 = 요금 폭증 방지(끄지 말 것)
nf.auth.external_users.use_external_creators_info = false;

await http.requestServiceMultipart(
  `/v1.0/companies/${cid}/members/${enc}/forms/${re.newFormId}`,
  { method: 'POST', tokenKind, query: { lang: 'ko' }, fields: { json: JSON.stringify({ idf: {}, input: { form: nf } }) }, files: [] },
);

// 4) 재배포(release) — 저장하면 is_release=false 가 되므로 다시 올린다
const start = new Date(); start.setHours(0, 0, 0, 0);
await http.requestService(`/v1.0/companies/${cid}/forms/${encodeURIComponent(re.newFormId)}/release/request`, {
  method: 'POST', tokenKind,
  body: { idf: {}, input: { target_date: start.getTime(), request_message: 'kiosk test', responder: member } },
});

// 5) 검증
const after = await getForm(re.newFormId);
console.log(JSON.stringify({
  form_id: re.newFormId,
  name: after.name,
  is_release: after.is_release,
  steps: (after.config.step_settings || []).map(s => s.seq + ':' + s.type + ':' + s.name),
  external: after.auth?.form_external_user,
}, null, 1));
