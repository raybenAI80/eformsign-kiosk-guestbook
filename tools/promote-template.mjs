/** 시험 템플릿을 운영본으로 승격 — 이름/약칭/설명 + 현행 운영본 설정 복사 + release 재확인.
 *  실행: node --env-file=.../.env tools/promote-template.mjs --form <새id> --ref <현운영본id> --name "..." [--title-rule "..."]
 *  🔴 이름만 바꿔 저장해도 is_release 가 내려간다 → 저장 후 반드시 release 재요청.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient, toCreateShapeAuthFromForm } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const FORM = arg('form');
const REF = arg('ref');
const NAME = arg('name');
const TITLE_RULE = arg('title-rule', '');
const DESC = arg('desc', '');
if (!FORM || !NAME) { console.error('need --form and --name'); process.exit(2); }

const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const http = client.templates.opts.http;
const member = process.env.EFORMSIGN_DEFAULT_MEMBER_ID;
const tokenKind = { member };
const cid = (await http.getCompany()).id;
const enc = encodeURIComponent(member);
const getForm = async (fid) => (await http.requestService(
  `/v1.0/companies/${cid}/members/${enc}/forms/${fid}`, { method: 'GET', tokenKind, query: { lang: 'ko' } }))?.result?.form;

const f = await getForm(FORM);
const before = JSON.parse(JSON.stringify(f));
const ref = REF ? await getForm(REF) : null;
const applied = [];
const skipped = [];

f.name = NAME; f.abbreviation = NAME; applied.push(['name/abbreviation', NAME]);
if (DESC) { f.desc = DESC; applied.push(['desc', DESC]); }

const w = (f.config.step_settings || []).find((s) => s.type === 'write');
if (TITLE_RULE && w) { w.option.doc_default_title = TITLE_RULE; applied.push(['doc_default_title', TITLE_RULE]); }
if (f.config.title_change !== true) { f.config.title_change = true; applied.push(['config.title_change', true]); }
else applied.push(['config.title_change', 'already true (no change)']);

f.auth = toCreateShapeAuthFromForm(f);
if (ref) {
  const r = ref.auth?.form_external_user || {};
  const e = f.auth.external_users;
  for (const k of ['use_external_users', 'use_recaptcha', 'use_external_creators_info', 'use_auth_external_creators',
                   'use_domains', 'use_auth_number_at_link', 'use_overlap_check', 'check_step_flag']) {
    if (k in r && JSON.stringify(e[k]) !== JSON.stringify(r[k])) { e[k] = r[k]; applied.push(['auth.external_users.' + k, r[k]]); }
  }
  if (r.use_auth_alert_option && JSON.stringify(e.use_auth_alert_option) !== JSON.stringify(r.use_auth_alert_option)) {
    e.use_auth_alert_option = r.use_auth_alert_option; applied.push(['auth.external_users.use_auth_alert_option', JSON.stringify(r.use_auth_alert_option)]);
  }
  // notification / display_settings / pdf_send 는 이미 동일한지 비교만 하고 다르면 복사
  for (const key of ['notification', 'display_settings', 'pdf_send']) {
    if (JSON.stringify(f.config[key]) !== JSON.stringify(ref.config[key])) {
      f.config[key] = JSON.parse(JSON.stringify(ref.config[key])); applied.push(['config.' + key, 'copied from ref']);
    } else skipped.push(['config.' + key, 'identical to ref — no change']);
  }
}

await http.requestServiceMultipart(`/v1.0/companies/${cid}/members/${enc}/forms/${FORM}`, {
  method: 'POST', tokenKind, query: { lang: 'ko' },
  fields: { json: JSON.stringify({ idf: {}, input: { form: f } }) }, files: [],
});
const afterSave = await getForm(FORM);
const releaseDroppedBySave = before.is_release === true && afterSave.is_release === false;

const start = new Date(); start.setHours(0, 0, 0, 0);
await http.requestService(`/v1.0/companies/${cid}/forms/${encodeURIComponent(FORM)}/release/request`, {
  method: 'POST', tokenKind,
  body: { idf: {}, input: { target_date: start.getTime(), request_message: 'guestbook kiosk v3 OZW', responder: member } },
});
const a = await getForm(FORM);
const aw = (a.config.step_settings || []).find((s) => s.type === 'write');
console.log(JSON.stringify({
  form_id: FORM, name: a.name, abbreviation: a.abbreviation,
  is_release_before_save: before.is_release, is_release_after_save: afterSave.is_release,
  release_dropped_by_save: releaseDroppedBySave, is_release_final: a.is_release,
  doc_default_title: aw?.option?.doc_default_title, title_change: a.config?.title_change,
  external: a.auth?.form_external_user?.use_external_users,
  recaptcha: a.auth?.form_external_user?.use_recaptcha,
  notif_points: (a.config.notification?.processing_status?.mail?.sending_points || []).length,
  display_settings: (a.config.display_settings || []).length,
  applied, skipped,
}, null, 1));
