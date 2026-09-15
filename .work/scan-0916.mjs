import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');
const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const memberId = process.env.EFORMSIGN_DEFAULT_MEMBER_ID;
const rows = [];
for (let p = 0; p < 200; p++) {
  const r = await client.documents.list({ type: '04', limit: 100, skip: p * 100, memberId });
  const docs = r.documents || r.items || r.list || [];
  if (!docs.length) break; rows.push(...docs); if (docs.length < 100) break;
}
rows.sort((a,b)=>(a.created_date||0)-(b.created_date||0));
console.log('전체 문서 n=', rows.length);
for (const d of rows) {
  const t = new Date(Number(d.created_date)).toISOString().replace('T',' ').slice(0,19);
  console.log([(d.id||d.document_id), t, (d.template?.id||'').slice(0,8), (d.template?.name||'').slice(0,40).padEnd(40), (d.current_status?.step_name||'').padEnd(8), d.document_name].join(' | '));
}
