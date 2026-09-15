/** 템플릿의 reCAPTCHA(로봇 자동 제출 방지) 스위치를 켜고 끈다.
 *  운영에서는 반드시 ON 이어야 한다(봇 대량 생성 = 문서 요금 폭증).
 *  자동화 검증 중에만 임시로 끄고, 끝나면 곧바로 되돌린다.
 *  node --env-file=.../.env set-recaptcha.mjs --form <formId> --on|--off
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient, toCreateShapeAuthFromForm } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const FORM = arg('form');
if (!FORM) { console.error('--form <formId> 필요'); process.exit(2); }
const ON = process.argv.includes('--on');
const OFF = process.argv.includes('--off');
if (ON === OFF) { console.error('--on 또는 --off 중 하나'); process.exit(2); }

const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const http = client.templates.opts.http;
const member = process.env.EFORMSIGN_DEFAULT_MEMBER_ID;
const tokenKind = { member };
const cid = (await http.getCompany()).id;
const enc = encodeURIComponent(member);
const getForm = async () => (await http.requestService(
  `/v1.0/companies/${cid}/members/${enc}/forms/${FORM}`, { method: 'GET', tokenKind, query: { lang: 'ko' } }
))?.result?.form;

const f = await getForm();
f.auth = toCreateShapeAuthFromForm(f);
const extArg = (process.argv.indexOf('--ext') > -1) ? process.argv[process.argv.indexOf('--ext') + 1] : 'on';
f.auth.external_users.use_external_users = (extArg !== 'off');
f.auth.external_users.use_recaptcha = ON;
await http.requestServiceMultipart(`/v1.0/companies/${cid}/members/${enc}/forms/${FORM}`, {
  method: 'POST', tokenKind, query: { lang: 'ko' },
  fields: { json: JSON.stringify({ idf: {}, input: { form: f } }) }, files: [],
});
const start = new Date(); start.setHours(0, 0, 0, 0);
await http.requestService(`/v1.0/companies/${cid}/forms/${encodeURIComponent(FORM)}/release/request`, {
  method: 'POST', tokenKind,
  body: { idf: {}, input: { target_date: start.getTime(), request_message: 'recaptcha toggle', responder: member } },
});
const after = await getForm();
console.log(JSON.stringify({ form: FORM, is_release: after.is_release, external: after.auth.form_external_user }, null, 1));
