import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');
const TPLS = ['c9f7a7de51bf426e910f13883180eb46','9f811e9bd2b44bb0aca8782b0b8c1223','283210e59ebe4156af5707effd2067b0'];
const PROTECT = new Set(['8844aae609b84078a59ef3118c64dab2','31de7ab146d14f2bb923d7a94d7122e5','9ee8126bcf4248a68d966a8b56759e6d','bf35f6c28c7945a48a9668fb00711466','e1fef806750248d5993c2ecee84e9502','e86be31eb2e3485184b94d3d58540095','ba4b17d0645c4ff2818db451eda38977','6365dcf14e7b4265b4cbb98e7c7c4b8f','f7542d23f2e141228ce14604e1874747','0c0a8338ca714a0bab4fc50af562a538','684511a337bf40459d5ea55f330731b1']);
const bad = TPLS.filter((id)=>PROTECT.has(id));
if (bad.length) { console.error('PROTECT 충돌', bad); process.exit(1); }
const memberId = process.env.EFORMSIGN_DEFAULT_MEMBER_ID;
const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY, defaultMemberId: memberId });
for (const id of TPLS) {
  try { const r = await client.templates.delete(id, { memberId }); console.log('TPL OK  ', id, JSON.stringify(r).slice(0,120)); }
  catch (e) { console.log('TPL ERR ', id, String(e).slice(0,200)); }
}
