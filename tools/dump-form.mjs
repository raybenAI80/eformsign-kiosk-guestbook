import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');
const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const http = client.templates.opts.http;
const member = process.env.EFORMSIGN_DEFAULT_MEMBER_ID; const tokenKind = { member };
const cid = (await http.getCompany()).id; const enc = encodeURIComponent(member);
const out = process.argv[process.argv.indexOf('--out')+1];
for (const fid of process.argv.slice(2).filter(x=>/^[0-9a-f]{32}$/.test(x))) {
  const f = (await http.requestService(`/v1.0/companies/${cid}/members/${enc}/forms/${fid}`, { method:'GET', tokenKind, query:{lang:'ko'} }))?.result?.form;
  fs.writeFileSync(`${out}/${fid}.json`, JSON.stringify(f, (k,v)=> (typeof v==='string'&&v.length>2000)?`<${v.length} chars>`:v, 1));
  console.log(fid, f.name, '| steps:', (f.config?.step_settings||[]).map(s=>s.seq+':'+s.type).join('>'));
}
