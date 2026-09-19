import {chromium} from 'playwright';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ff=require('ffmpeg-static'),fp=require('ffprobe-static').path;
const dir='artifacts/raw/state-video';await mkdir(dir,{recursive:true});
const browser=await chromium.launch();
const shots=[
 {id:'choose',initial:0,input:1,title:'AI assembly.',accent:'Watch the state change.',delay:1000},
 {id:'score',initial:0,input:1,title:'SCORE writes a register.',accent:'ST changes the motion.',delay:1300},
 {id:'test',initial:0,input:1,title:'TEST sets a probability.',accent:'BLT takes the branch.',delay:1050},
 {id:'batch',initial:0,input:2,title:'JUDGE commits answers.',accent:'LD reads. ST reacts.',delay:850},
];
const css=`
*{box-sizing:border-box}html,body{margin:0!important;width:1080px;height:1080px;overflow:hidden!important;background:#f4f0e6!important}body>*{display:none!important}body>#film{display:block!important;position:fixed;inset:0;padding:34px 40px;color:#302f3d;font-family:'DM Sans',Arial,sans-serif}
.brand{display:flex;justify-content:space-between;font:17px 'DM Mono',monospace;letter-spacing:1px;color:#7254b6}#title{font-size:57px;line-height:1.08;margin:27px 0 0;letter-spacing:-1.8px}#title em{display:block;font-style:normal;color:#7254b6}#message{position:absolute;top:229px;left:40px;width:1000px;font-size:23px;line-height:1.35;background:transparent;border:0;padding:0;margin:0}#message:before{content:'INPUT  ';font:14px 'DM Mono',monospace;color:#82718d}
#listing{position:absolute;left:40px;top:316px;width:465px;height:437px;background:#faf8f2;border:1px solid #d4cbbd;border-radius:5px;overflow:hidden;padding:12px 0}.listing-label{padding:0 16px 12px;color:#80758a;font:13px 'DM Mono',monospace;letter-spacing:1px}.line{height:40px;display:flex;align-items:center;gap:14px;font:21px 'DM Mono',monospace;padding:0 16px;border-left:4px solid transparent}.line .addr{font-size:13px;color:#95879c;width:24px}.line .op{font-weight:500;color:#7254b6}.line.active{background:#e9ddf8;border-left-color:#7254b6}.line.branch{background:#f6e3cc;border-left-color:#da7145}
#film .display-panel{position:absolute;top:316px;left:525px;width:515px;height:437px;background:#dbd3c6;padding:9px;border-radius:6px;box-shadow:3px 4px #c6beae}.display-panel .panel-heading,.screen-base,.scene-caption,.coordinate{display:none!important}#film .canvas-wrap{height:417px!important}#film canvas{object-fit:contain}.canvas-corner{font-size:14px!important}.canvas-corner span{display:none!important}
#states{position:absolute;top:784px;left:40px;width:1000px;display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.state{background:#ebe6dc;border:1px solid #d4cbbd;padding:14px 12px;border-radius:4px}.state small{font:12px 'DM Mono',monospace;color:#7e7386;display:block;margin-bottom:11px}.state b{font:23px 'DM Mono',monospace;white-space:nowrap}.state.changed{background:#e8daf8;border-color:#ae91d0}.state.changed b{color:#7254b6}#explain{position:absolute;top:904px;left:40px;width:1000px;font-size:26px;font-weight:500;line-height:1.4}.note{position:absolute;bottom:26px;left:40px;font:15px 'DM Mono',monospace;color:#7b7084}.progress{position:absolute;bottom:0;left:0;height:7px;background:#7254b6}
`;
const manifest=[];
for(const [index,s] of shots.entries()){
 const context=await browser.newContext({viewport:{width:1080,height:1080},recordVideo:{dir,size:{width:1080,height:1080}}});const p=await context.newPage();const errors=[];let calls=0;
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('/api/'))calls++});await p.goto('http://localhost:4173');await p.evaluate(()=>document.fonts.ready);
 await p.evaluate(async s=>{
  const {makeCartridge,DEMO_EXAMPLES}=await import('/lib/semantic.js');const {decode,disassemble,SEMANTIC_OPS}=await import('/lib/vm.js');
  window.jrisc.load(makeCartridge(s.id));const vm=window.jrisc.vm;vm.context={message:DEMO_EXAMPLES[s.id][s.initial][1]};
  let seen=false;for(let n=0;n<40;n++){if(seen&&SEMANTIC_OPS.includes(decode(vm.words[vm.pc]).op))break;if(SEMANTIC_OPS.includes(decode(vm.words[vm.pc]).op))seen=true;await vm.step();if(vm.error)throw Error(vm.error);}
  window.filmDecode=decode;window.filmSource=disassemble(vm.words).split('\n');vm.context={message:DEMO_EXAMPLES[s.id][s.input][1]};
 },s);
 await p.addStyleTag({content:css});
 await p.evaluate(({s,index})=>{
  // Preserve the live VM and canvas; reframe them only for the recording.
  const root=document.createElement('div');root.id='film';root.innerHTML='<div class="brand"><b>JRISC / JEV OPCODES</b><span>8 REGISTERS · 16-BIT STATE</span></div><h1 id="title"></h1><p id="message"></p><div id="listing"><div class="listing-label">EXECUTING THE REAL PROGRAM</div></div><div id="states"></div><div id="explain"></div><div class="note">REAL VM · FIXED DEMO RESPONSES · SLOW STEP-THROUGH</div><div class="progress"></div>';
  // Rename the hidden original input so the on-screen message ID stays unique.
  document.getElementById('message').id='original-message';document.body.append(root);
  root.querySelector('h1').append(document.createTextNode(s.title));const em=document.createElement('em');em.textContent=s.accent;root.querySelector('h1').append(em);
  document.getElementById('message').textContent=window.jrisc.vm.context.message;
  root.append(document.querySelector('.display-panel'));root.querySelector('.progress').style.width=((index+1)/4*100)+'%';
  for(let i=5;i<window.filmSource.length;i++) {const line=document.createElement('div');line.className='line';line.dataset.pc=i;const tokens=window.filmSource[i].split(' ');line.innerHTML='<span class="addr"></span><span class="op"></span><span class="args"></span>';line.children[0].textContent=String(i).padStart(2,'0');line.children[1].textContent=tokens.shift();line.children[2].textContent=tokens.join(' ');document.getElementById('listing').append(line);}
  window.filmState=()=>{const v=window.jrisc.vm;return [v.pc,v.r[0],v.mem[0xe001],v.mem[0xf001],v.mem[0xf004]]};
  window.filmPaint=(before,after)=>{const names=['PC','R0','E001 · ANSWER','F001 · COLOR','F004 · ENERGY'];document.getElementById('states').replaceChildren(...names.map((name,i)=>{const el=document.createElement('div');el.className='state'+(before[i]!==after[i]?' changed':'');const small=document.createElement('small');small.textContent=name;const b=document.createElement('b');b.textContent=before[i]===after[i]?String(after[i]):`${before[i]} → ${after[i]}`;el.append(small,b);return el;}));};
  window.filmPaint(window.filmState(),window.filmState());document.getElementById('explain').textContent='New input. Same program. Watch what changes.';
 },{s,index});
 await p.waitForTimeout(250);const start=Date.now();await p.waitForTimeout(900);const steps=[];
 for(let n=0;n<20;n++){
  const step=await p.evaluate(async()=>{
   const vm=window.jrisc.vm,pc=vm.pc,d=window.filmDecode(vm.words[pc]),before=window.filmState(),regs=[...vm.r];
   await vm.step();if(vm.error)throw Error(vm.error);const after=window.filmState();window.filmPaint(before,after);
   document.querySelectorAll('.line').forEach(el=>{el.classList.toggle('active',Number(el.dataset.pc)===pc);el.classList.toggle('branch',Number(el.dataset.pc)===pc&&['BEQ','BLT','JMP'].includes(d.op));});
   let note='';
   if(d.op==='CHOOSE')note=`CHOOSE selects ${vm.bank.answers.mood.choice}. R${d.a} receives ${vm.r[d.a]}.`;
   else if(d.op==='SCORE')note=`SCORE puts ${vm.r[d.a]} in R${d.a}. Pixels have not changed yet.`;
   else if(d.op==='TEST')note=`TEST: ${Math.round(vm.bank.answers.kindness.noul*100)}% yes → R${d.a} = ${vm.r[d.a]}.`;
   else if(d.op==='JUDGE')note='JUDGE commits four answers together. Registers stay unchanged.';
   else if(d.op==='CONF')note=`CONF reads confidence into R${d.a}: ${vm.r[d.a]}. No new request.`;
   else if(d.op==='LI')note=`LI sets R${d.a} = ${vm.r[d.a]}.`;
   else if(d.op==='LD')note=`LD copies the decision-bank value into R${d.a}: ${vm.r[d.a]}.`;
   else if(d.op==='ST')note=(regs[d.b]+d.i===0xf001)?`ST writes palette ${vm.mem[0xf001]}. Now the pixels change.`:`ST writes energy ${vm.mem[0xf004]}. Now the motion changes.`;
   else if(d.op==='BLT')note=`${regs[d.a]} < ${regs[d.b]} → branch taken. PC skips to ${vm.pc}.`;
   else if(d.op==='BEQ')note=vm.pc!==pc+1?'Unknown mood → keep the old palette.':`${regs[d.a]} ≠ ${regs[d.b]} → keep going. Color write is next.`;
   else if(d.op==='JMP')note='JMP returns to the input instruction. Ready for the next message.';
   document.getElementById('explain').textContent=note;
   return {pc,op:d.op,before,after,next:vm.pc};
  });steps.push(step);await p.waitForTimeout(s.delay);await p.screenshot({path:`${dir}/${s.id}-${n}.png`});if(step.next===5)break;
 }
 if(index===3){await p.evaluate(()=>{document.getElementById('title').innerHTML='AI belongs in the ISA?<em>You tell me.</em>';document.getElementById('explain').textContent='github.com/tensorfish/jrisc';});await p.waitForTimeout(3000);}
 const duration=(Date.now()-start)/1000;const trace=await p.evaluate(()=>window.jrisc.vm.export());await writeFile(`${dir}/${s.id}-trace.json`,JSON.stringify({steps,trace},null,2));const video=p.video();await context.close();await rename(await video.path(),`${dir}/${s.id}.webm`);if(errors.length||calls)throw Error(JSON.stringify({errors,calls}));
 const rawDuration=Number(execFileSync(fp,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',`${dir}/${s.id}.webm`],{encoding:'utf8'}));manifest.push({id:s.id,duration,start:Math.max(0,rawDuration-duration-.1),steps});console.log('Captured',s.id,duration);
}
await browser.close();await writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2));
for(const s of manifest)execFileSync(ff,['-y','-ss',String(s.start),'-i',`${dir}/${s.id}.webm`,'-t',String(s.duration),'-vf','fps=30,format=yuv420p','-an','-c:v','libx264','-preset','fast','-crf','19',`${dir}/${s.id}.mp4`],{stdio:'pipe'});
await writeFile(`${dir}/concat.txt`,manifest.map(s=>`file '${s.id}.mp4'`).join('\n'));
execFileSync(ff,['-y','-f','concat','-safe','0','-i',`${dir}/concat.txt`,'-c','copy','-movflags','+faststart','artifacts/jrisc-opcodes.mp4'],{stdio:'pipe'});
execFileSync(ff,['-y','-ss','3','-i','artifacts/jrisc-opcodes.mp4','-frames:v','1','artifacts/jrisc-opcodes-cover.png'],{stdio:'pipe'});
console.log('Created artifacts/jrisc-opcodes.mp4');
