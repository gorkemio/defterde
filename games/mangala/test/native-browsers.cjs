// Existing installed browsers, isolated Firefox profile. No packages/downloads.
// Firefox WebDriver BiDi: https://developer.mozilla.org/en-US/docs/Web/WebDriver/How_to/Create_BiDi_connection
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const report = { date: new Date().toISOString(), checks: [], unavailable: [] };
const local = 'http://127.0.0.1:18765/index.html';
const file = pathToFileURL(path.resolve('index.html')).href;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const exercise = `async function () {
  await document.fonts.ready;
  const M = Mangala;
  M.app.newGame({mode:'local',sets:5},{firstPlayer:0});
  let moves=0, seed=12345;
  for(let set=1;set<=5;set++) {
    while(M.app.snapshot().board.status==='playing' && moves<2000) {
      const choices=M.board.legalMoves(M.app.snapshot().board);
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const pending=M.app.play(choices[seed%choices.length]); M.app.skip(); await pending; moves++;
    }
    if(set<5) document.getElementById('next-set').click();
  }
  const match=M.app.snapshot();
  M.app.undo(); const undone=M.app.snapshot().results.length===4;
  M.app.newGame({mode:'computer',difficulty:'hard'},{firstPlayer:0});
  const p=M.app.play(0); M.app.skip(); await p; M.app.undo();
  await new Promise(r=>setTimeout(r,850));
  const initial=M.app.snapshot().board.counts;
  document.getElementById('help-open').click();
  document.getElementById('example-play').click();
  const unchanged=JSON.stringify(M.app.snapshot().board.counts)===JSON.stringify(initial);
  document.querySelector('[data-close="help-dialog"]').click();
  return {sets:match.results.length,status:match.board.status,sum:match.board.counts.reduce((a,b)=>a+b),moves,undone,unchanged,
   cancel:JSON.stringify(initial)==='[4,4,4,4,4,4,0,4,4,4,4,4,4,0]',
   width:innerWidth,pageWidth:document.documentElement.scrollWidth,pits:document.querySelectorAll('.pit').length};
}`;
async function firefox() {
  const profile=fs.mkdtempSync('/private/tmp/mangala-native-firefox-');
  const child=spawn('/Applications/Firefox.app/Contents/MacOS/firefox',['--headless','--no-remote','--profile',profile,'--remote-debugging-port','19283','about:blank']);
  let logs=''; child.stderr.on('data',d=>{logs+=d;});
  let ws;
  try {
    for(let i=0;i<40;i++) { try { await fetch('http://127.0.0.1:19283/'); break; } catch { await sleep(250); } }
    ws=new WebSocket('ws://127.0.0.1:19283/session');
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=()=>reject(new Error('Firefox socket failed: '+logs));});
    let id=0; const waiting=new Map();
    ws.onmessage=event=>{const m=JSON.parse(event.data); if(waiting.has(m.id)){const {resolve,reject,timer}=waiting.get(m.id);clearTimeout(timer);waiting.delete(m.id);m.type==='error'?reject(new Error(m.message)):resolve(m.result);}};
    const call=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;const timer=setTimeout(()=>reject(new Error(method+' timeout')),30000);waiting.set(next,{resolve,reject,timer});ws.send(JSON.stringify({id:next,method,params}));});
    const session=await call('session.new',{capabilities:{alwaysMatch:{}}});
    const tab=await call('browsingContext.create',{type:'tab'}); const context=tab.context;
    for(const url of [file,local]) {
      await call('browsingContext.navigate',{context,url,wait:'complete'});
      await call('browsingContext.setViewport',{context,viewport:{width:390,height:844}});
      const output=await call('script.evaluate',{expression:`(${exercise})().then(JSON.stringify)`,target:{context},awaitPromise:true});
      if(output.type==='exception') throw new Error(JSON.stringify(output.exceptionDetails));
      const value=JSON.parse(output.result.value);
      if(value.sets!==5||value.status!=='finished'||value.sum!==48||!value.undone||!value.unchanged||!value.cancel||value.width!==value.pageWidth) throw new Error(JSON.stringify(value));
      report.checks.push({engine:'Firefox',version:session.capabilities.browserVersion,protocol:url.startsWith('file')?'file':'http',...value});
    }
    await call('session.end');
  } catch(error) { report.unavailable.push({engine:'Firefox',error:error.message,logs:logs.slice(-3000)}); }
  finally { ws?.close(); child.kill(); await sleep(300); fs.rmSync(profile,{recursive:true,force:true}); }
}
async function safari() {
  const child=spawn('/usr/bin/safaridriver',['--port','19284']);let logs='';child.stderr.on('data',d=>{logs+=d;});
  let session;
  const call=async(method,url,data)=>{const res=await fetch('http://127.0.0.1:19284'+url,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});const json=await res.json();if(json.value?.error)throw new Error(json.value.message);return json.value;};
  try {
    for(let i=0;i<20;i++){try{await call('GET','/status');break;}catch{await sleep(250);}}
    session=await call('POST','/session',{capabilities:{alwaysMatch:{browserName:'safari'}}});
    for(const url of [file,local]) {
      await call('POST',`/session/${session.sessionId}/url`,{url});
      const value=await call('POST',`/session/${session.sessionId}/execute/async`,{script:`const done=arguments[arguments.length-1]; (${exercise})().then(done,e=>done({error:String(e)}));`,args:[]});
      if(value.error||value.sets!==5||value.status!=='finished'||value.sum!==48||!value.undone||!value.cancel)throw new Error(JSON.stringify(value));
      report.checks.push({engine:'Safari',version:session.capabilities.browserVersion,protocol:url.startsWith('file')?'file':'http',...value});
    }
  }catch(error){report.unavailable.push({engine:'Safari',error:error.message,logs});}
  finally {if(session)await call('DELETE',`/session/${session.sessionId}`).catch(()=>{});child.kill();}
}
(async()=>{await firefox();await safari();fs.writeFileSync('docs/native-browser-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));})();
