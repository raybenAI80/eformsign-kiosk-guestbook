/** 방문자 기록부 OZR → 새 템플릿 배포 + 키오스크 조건 세팅.
 *  하는 일: createFromFile(시작→완료 2단계) → config.notification 기본값 채움(400 5000004 예방)
 *          → display_settings 구성 → 필수 필드 표시 → URL로 문서 생성 허용 ON + reCAPTCHA ON → release
 *  실행: node --env-file=D:/pjt/eformsign/eformsign-core/.env deploy-guestbook.mjs [--name <이름>] [--form <기존id>] [--recaptcha on|off]
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  EformsignClient, EFORMSIGN_DEFAULT_NOTIFICATION, EFORMSIGN_SYSTEM_COLUMNS, toCreateShapeAuth,
} = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const NAME = arg('name', '방문자 기록부(방명록)');
const OZR = arg('ozr', 'D:/pjt/eformsign/kiosk-guestbook/form/guestbook.ozr');
const RECAPTCHA = arg('recaptcha', 'on') === 'on';
let FORM = arg('form', '');

const REQUIRED_FIELDS = ['방문일시', '방문자성명', '소속', '연락처', '방문목적', '담당자', '개인정보동의', '방문자서명'];

const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const http = client.templates.opts.http;
const member = process.env.EFORMSIGN_DEFAULT_MEMBER_ID;
const tokenKind = { member };
const cid = (await http.getCompany()).id;
const enc = encodeURIComponent(member);
const getForm = async (fid) => (await http.requestService(
  `/v1.0/companies/${cid}/members/${enc}/forms/${fid}`, { method: 'GET', tokenKind, query: { lang: 'ko' } }))?.result?.form;

if (!FORM) {
  const created = await client.templates.createFromFile({
    name: NAME, abbreviation: NAME, category: '키오스크',
    description: '방명록 키오스크용. URL로 문서 생성 허용 ON, reCAPTCHA ON.',
    memberId: member,
    file: { filename: 'guestbook.ozr', data: readFileSync(OZR) },
  });
  FORM = created?.result?.form?.form_id || created?.result?.form?.id || created?.result?.form_id
    || created?.result?.id || created?.form_id || created?.id
    || created?._metadata?.verification?.form_id;
  if (!FORM) {
    const m = JSON.stringify(created).match(/"form_id"\s*:\s*"([0-9a-f]{32})"/);
    FORM = m && m[1];
  }
  if (!FORM) { console.error('created but id not found; raw =', JSON.stringify(created).slice(0, 1200)); process.exit(2); }
  console.log('created form', FORM);
}

const f = await getForm(FORM);
f.auth = toCreateShapeAuth(f.auth);
f.config.notification = JSON.parse(JSON.stringify(EFORMSIGN_DEFAULT_NOTIFICATION));

const controls = f.config.parameters?.default_input_controls || [];
for (const c of controls) if (REQUIRED_FIELDS.includes(c.name)) c.required = true;

f.config.display_settings = [
  ...EFORMSIGN_SYSTEM_COLUMNS.map((c, i) => ({ ...c, seq: i + 1, form_index: 0 })),
  ...controls.map((c, i) => ({
    seq: EFORMSIGN_SYSTEM_COLUMNS.length + i + 1, name: c.name, display_name: c.name,
    displayable: ['방문일시', '방문자성명', '소속', '방문목적', '담당자'].includes(c.name), form_index: 0,
  })),
];

const writeStep = (f.config.step_settings || []).find((s) => s.type === 'write');
if (writeStep) {
  writeStep.input_control_option = controls.map((c) => ({
    name: c.name,
    input_type: c.input_type,
    accessible: true,
    required: REQUIRED_FIELDS.includes(c.name),
    section: c.section ?? null,
    data_type: c.data_type ?? null,
  }));
}

f.auth.external_users.use_external_users = true;
f.auth.external_users.use_recaptcha = RECAPTCHA;
f.auth.external_users.use_external_creators_info = false;

await http.requestServiceMultipart(`/v1.0/companies/${cid}/members/${enc}/forms/${FORM}`, {
  method: 'POST', tokenKind, query: { lang: 'ko' },
  fields: { json: JSON.stringify({ idf: {}, input: { form: f } }) }, files: [],
});
const start = new Date(); start.setHours(0, 0, 0, 0);
await http.requestService(`/v1.0/companies/${cid}/forms/${encodeURIComponent(FORM)}/release/request`, {
  method: 'POST', tokenKind,
  body: { idf: {}, input: { target_date: start.getTime(), request_message: 'guestbook kiosk', responder: member } },
});

const a = await getForm(FORM);
console.log(JSON.stringify({
  form_id: FORM, name: a.name, is_release: a.is_release,
  steps: (a.config.step_settings || []).map((s) => `${s.seq}:${s.type}`),
  notification_points: (a.config.notification?.processing_status?.mail?.sending_points || []).length,
  display_settings: (a.config.display_settings || []).length,
  controls: (a.config.parameters?.default_input_controls || []).map((c) => `${c.name}:${c.input_type}`),
  write_step_ico: ((a.config.step_settings || []).find((s) => s.type === 'write')?.input_control_option || [])
    .map((c) => `${c.name}${c.accessible ? '+' : '-'}${c.required ? '*' : ''}`),
  external: a.auth?.form_external_user?.use_external_users,
  recaptcha: a.auth?.form_external_user?.use_recaptcha,
  public_url: `https://www.eformsign.com/eform/document/external_user_view_service.html?company_id=${cid}&form_id=${FORM}&lang_code=ko&country_code=kr`,
}, null, 1));
