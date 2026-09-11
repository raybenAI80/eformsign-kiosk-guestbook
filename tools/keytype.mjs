/** 물리 키 이벤트로 타이핑(Input.insertText 가 OZ 뷰어에 안 먹는 경우용). ASCII 전용. */
const arg=(n,d)=>{const i=process.argv.indexOf('--'+n);return i>-1?process.argv[i+1]:d;};
const PORT=arg('port','9233'); const TEXT=arg('text','TEST');
const X=Number(arg('x','0')), Y=Number(arg('y','0'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const targets=await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const t=targets.find(x=>x.type==='page');
const ws=new WebSocket(t.webSocketDebuggerUrl);
let id=0;const pend=new Map();
const send=(m,p)=>new Promise((res,rej)=>{const i=++id;pend.set(i,{res,rej});ws.send(JSON.stringify({id:i,method:m,params:p}));});
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result);}};
await new Promise(r=>ws.onopen=r);
if(X){await send('Input.dispatchMouseEvent',{type:'mousePressed',x:X,y:Y,button:'left',clickCount:1});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:X,y:Y,button:'left',clickCount:1});await sleep(1500);}
for(const ch of TEXT){
  await send('Input.dispatchKeyEvent',{type:'keyDown',text:ch,unmodifiedText:ch,key:ch,windowsVirtualKeyCode:ch.toUpperCase().charCodeAt(0)});
  await send('Input.dispatchKeyEvent',{type:'char',text:ch,unmodifiedText:ch,key:ch});
  await send('Input.dispatchKeyEvent',{type:'keyUp',text:ch,unmodifiedText:ch,key:ch,windowsVirtualKeyCode:ch.toUpperCase().charCodeAt(0)});
  await sleep(60);
}
await sleep(600); ws.close(); console.log('typed', TEXT);
