/** 2단계 400 원인 분리 — config 의 건강 항목을 하나씩 채워 넣고 재배포한다.
 *  node --env-file=... repair-config.mjs --form <id> [--notification] [--display] [--revert]
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient, EFORMSIGN_DEFAULT_NOTIFICATION, EFORMSIGN_SYSTEM_COLUMNS, toCreateShapeAuthFromForm } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const has = n => process.argv.includes('--' + n);
const FORM = arg('form');
const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const http = client.templates.opts.http;
const member = process.env.EFORMSIGN_DEFAULT_MEMBER_ID; const tokenKind = { member };
const cid = (await http.getCompany()).id; const enc = encodeURIComponent(member);
const getForm = async () => (await http.requestService(`/v1.0/companies/${cid}/members/${enc}/forms/${FORM}`, { method:'GET', tokenKind, query:{lang:'ko'} }))?.result?.form;

const f = await getForm();
f.auth = toCreateShapeAuthFromForm(f);
const before = { ds: (f.config.display_settings||[]).length, notif: (f.config.notification?.processing_status?.mail?.sending_points||[]).length };

if (has('revert')) { f.config.notification = {}; f.config.display_settings = []; }
if (has('notification')) f.config.notification = JSON.parse(JSON.stringify(EFORMSIGN_DEFAULT_NOTIFICATION));
if (has('display')) {
  const fields = (f.config.parameters?.default_input_controls || []).map(c => c.name);
  f.config.display_settings = [
    ...EFORMSIGN_SYSTEM_COLUMNS.map((c, i) => ({ ...c, seq: i + 1, form_index: 0 })),
    ...fields.map((n, i) => ({ seq: EFORMSIGN_SYSTEM_COLUMNS.length + i + 1, name: n, display_name: n, displayable: false, form_index: 0 })),
  ];
}
await http.requestServiceMultipart(`/v1.0/companies/${cid}/members/${enc}/forms/${FORM}`, {
  method:'POST', tokenKind, query:{lang:'ko'}, fields:{ json: JSON.stringify({ idf:{}, input:{ form: f } }) }, files: [] });
const start = new Date(); start.setHours(0,0,0,0);
await http.requestService(`/v1.0/companies/${cid}/forms/${encodeURIComponent(FORM)}/release/request`, {
  method:'POST', tokenKind, body:{ idf:{}, input:{ target_date: start.getTime(), request_message:'cause bisect', responder: member } } });
const a = await getForm();
console.log(JSON.stringify({ form: FORM, before, after: { ds:(a.config.display_settings||[]).length, notif:(a.config.notification?.processing_status?.mail?.sending_points||[]).length, release:a.is_release, ext:a.auth?.form_external_user?.use_external_users, recap:a.auth?.form_external_user?.use_recaptcha } }));
