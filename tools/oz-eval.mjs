/** eformsign 작성 iframe(그리고 그 안의 OZ 뷰어 프레임)에서 JS 를 평가한다.
 * node tools/oz-eval.mjs --port 9233 --expr "<js>"
 */
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i>-1?process.argv[i+1]:d;};
const PORT=arg('port','9233'); const EXPR=arg('expr','1');
const targets=await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const t=targets.find(x=>x.type==='iframe'&&/external_user_view_service/.test(x.url||''));
if(!t){console.error('eformsign iframe target 없음');process.exit(2);}
const ws=new WebSocket(t.webSocketDebuggerUrl);
let id=0;const pend=new Map();
const send=(m,p)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);}};
await new Promise(r=>ws.onopen=r);
const r=await send('Runtime.evaluate',{expression:EXPR,returnByValue:true,awaitPromise:true});
console.log(JSON.stringify(r.exceptionDetails?{error:r.exceptionDetails.exception?.description}:r.result?.value));
ws.close();
