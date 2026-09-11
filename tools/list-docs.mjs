import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { EformsignClient } = require('D:/pjt/eformsign/eformsign-core/dist/src/index.js');
const client = new EformsignClient({ apiKey: process.env.EFORMSIGN_API_KEY, privateKey: process.env.EFORMSIGN_PRIVATE_KEY });
const r = await client.documents.list({ type: '04', pageSize: 20, memberId: process.env.EFORMSIGN_DEFAULT_MEMBER_ID, templateIds: process.argv.slice(2).filter(x=>/^[0-9a-f]{32}$/.test(x)) });
for (const d of (r.documents || r.items || r.list || [])) console.log(d.document_id||d.id, '|', (d.current_status&&d.current_status.step_name)||d.current_status, '|', d.title, '|', d.create_date || d.created_date || '');
