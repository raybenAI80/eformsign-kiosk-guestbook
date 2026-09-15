/** 기존 템플릿의 양식 파일(.ozr)을 같은 form_id 로 교체한다(콘솔 '양식 파일 교체' 대응).
 *  node --env-file=... replace-form-file.mjs --form <id> --ozr <path>
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient, toCreateShapeAuthFromForm } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const FORM = arg('form'); const OZR = arg('ozr');
const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const http = client.templates.opts.http;
const member = process.env.EFORMSIGN_DEFAULT_MEMBER_ID; const tokenKind = { member };
const cid = (await http.getCompany()).id; const enc = encodeURIComponent(member);
const getForm = async () => (await http.requestService(`/v1.0/companies/${cid}/members/${enc}/forms/${FORM}`, { method: 'GET', tokenKind, query: { lang: 'ko' } }))?.result?.form;
const f = await getForm();
f.auth = toCreateShapeAuthFromForm(f);
const before = (f.config.parameters?.default_input_controls || []).map((c) => c.name);
await http.requestServiceMultipart(`/v1.0/companies/${cid}/members/${enc}/forms/${FORM}`, {
  method: 'POST', tokenKind, query: { lang: 'ko' },
  fields: { json: JSON.stringify({ idf: {}, input: { form: f } }) },
  files: [{ fieldName: 'file', filename: 'guestbook.ozr', contentType: 'application/octet-stream', data: readFileSync(OZR) }],
});
const start = new Date(); start.setHours(0, 0, 0, 0);
await http.requestService(`/v1.0/companies/${cid}/forms/${encodeURIComponent(FORM)}/release/request`, {
  method: 'POST', tokenKind, body: { idf: {}, input: { target_date: start.getTime(), request_message: 'form file replace', responder: member } } });
const a = await getForm();
console.log(JSON.stringify({ form: FORM, before, after: (a.config.parameters?.default_input_controls || []).map((c) => c.name), ozr_id: a.file?.form_files?.[0]?.file_id, release: a.is_release }, null, 1));
