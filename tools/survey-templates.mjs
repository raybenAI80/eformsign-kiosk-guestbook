/** 모든 템플릿의 워크플로 단계 + 외부URL허용 설정을 훑는다. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');
const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const http = client.templates.opts.http;
const member = process.env.EFORMSIGN_DEFAULT_MEMBER_ID;
const tokenKind = { member };
const cid = (await http.getCompany()).id;
const enc = encodeURIComponent(member);
const list = await http.requestService(`/v1.0/companies/${cid}/members/${enc}/forms`, { method:'GET', tokenKind, query:{ lang:'ko', page:1, page_size:200 } });
const forms = list?.result?.forms || list?.result?.form_list || [];
console.log('LIST KEYS', Object.keys(list?.result||{}), 'n=', forms.length);
const out = [];
for (const f0 of forms) {
  const fid = f0.id || f0.form_id;
  try {
    const f = (await http.requestService(`/v1.0/companies/${cid}/members/${enc}/forms/${fid}`, { method:'GET', tokenKind, query:{lang:'ko'} }))?.result?.form;
    const steps = (f.config?.step_settings||[]).map(s=>`${s.seq}:${s.type}`).join('>');
    out.push({ fid, name: f.name, steps, nsteps:(f.config?.step_settings||[]).length, rel: f.is_release,
      ext: f.auth?.form_external_user?.use_external_users, recap: f.auth?.form_external_user?.use_recaptcha,
      created: f0.create_date||f0.created_date||f.create_date, updated: f0.update_date||f.update_date, type: f.form_type||f0.form_type });
  } catch(e) { out.push({ fid, name: f0.name, err: String(e).slice(0,100) }); }
}
console.log(JSON.stringify(out, null, 1));
