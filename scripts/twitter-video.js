import { chromium } from 'playwright';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ffmpeg=require('ffmpeg-static'), ffprobe=require('ffprobe-static').path;
const out='artifacts/raw/twitter'; await mkdir(out,{recursive:true});
const browser=await chromium.launch();
const shots=[
 {id:'01-hook',kind:'choose',index:0,seconds:4,title:'AI if statements?',accent:'Meet AI assembly.',code:'CHOOSE R0, 1',caption:'A message becomes a value your program can use.'},
 {id:'02-twist',kind:'choose',index:0,next:1,seconds:4,title:'Same program.',accent:'Different words.',code:'CHOOSE → BRANCH → PIXELS',caption:'Warm → rose. Angry → amber.'},
 {id:'03-score',kind:'score',index:0,next:1,seconds:5,title:'Words become numbers.',accent:'Numbers control motion.',code:'SCORE R0, 2',caption:'Quiet = slow. Excited = fast.'},
 {id:'04-test',kind:'test',index:0,next:1,seconds:5,title:'Kindness',accent:'is a branch.',code:'TEST R0, 3  →  BLT R0, R1, paint',caption:'One probability. A 60% threshold.'},
 {id:'05-batch',kind:'batch',index:2,seconds:5,title:'One snapshot.',accent:'Four decisions.',code:'JUDGE 0',caption:'Mood + energy + kindness + intent.'},
 {id:'06-end',kind:'choose',index:0,seconds:4,title:'Useful primitive',accent:'or ridiculous toy?',code:'github.com/tensorfish/jrisc',caption:'What would you build with AI assembly?'},
];
const css=`
*{box-sizing:border-box}html,body{margin:0!important;width:1080px;height:1080px;overflow:hidden!important;background:#f4f0e6!important}body>*{display:none!important}body>#twitter-stage{display:block!important;position:fixed;inset:0;font-family:'DM Sans',Arial,sans-serif;color:#302f3d;padding:34px 48px}
.brandline{font:18px 'DM Mono',monospace;letter-spacing:2px;display:flex;justify-content:space-between;color:#706279}.brandline b{color:#7254b6}.video-title{font-size:68px;line-height:1.04;letter-spacing:-2.7px;font-weight:700;margin:22px 0 0}.video-title em{font-style:normal;color:#7254b6;display:block}.video-message{position:absolute;top:245px;left:48px;width:984px;margin:0;font-size:25px;line-height:1.3;color:#50465b;min-height:65px;display:flex;align-items:center}.video-message:before{content:'INPUT';font:13px 'DM Mono',monospace;letter-spacing:2px;color:#8c789d;margin-right:20px}
#twitter-stage .display-panel{position:absolute;left:48px;top:328px;width:984px;height:430px;padding:9px;background:#dad1c4;border:1px solid #bcb2a4;box-shadow:4px 5px #c8bfaf;border-radius:8px}.display-panel>.panel-heading,.screen-base{display:none!important}#twitter-stage .canvas-wrap{height:410px!important;margin:0;border:3px solid #82796e}#twitter-stage canvas{object-fit:contain}#twitter-stage .canvas-corner{top:18px;left:20px;font-size:14px}#twitter-stage .canvas-corner span{font-size:11px}#twitter-stage .scene-caption{bottom:22px}#twitter-stage .scene-caption>span{font-size:31px}#twitter-stage .coordinate{font-size:10px}
#video-answers{position:absolute;top:783px;left:48px;width:984px}#video-answers #decisions{display:flex!important;gap:12px}#video-answers .decision{display:flex;align-items:center;gap:12px;flex:1;padding:14px 18px;background:#e9e0f3;border:0;border-radius:3px}#video-answers .decision:before,#video-answers .bar{display:none}#video-answers .decision small{font-size:13px}#video-answers .decision b{font-size:21px;margin:0}.video-code{position:absolute;top:884px;left:48px;font:26px 'DM Mono',monospace;color:#7254b6}.video-caption{position:absolute;top:933px;left:48px;font-size:25px;font-weight:500}.video-note{position:absolute;bottom:26px;left:48px;font:15px 'DM Mono',monospace;color:#756d7e}.video-progress{position:absolute;bottom:0;left:0;height:7px;background:#7254b6}
`;
const manifest=[];
for(let n=0;n<shots.length;n++){
 const s=shots[n];
 const context=await browser.newContext({viewport:{width:1080,height:1080},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1080,height:1080}}});
 const page=await context.newPage();let apiCalls=0;const errors=[];
 page.on('request',r=>{if(r.url().includes('/api/'))apiCalls++});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4173');await page.evaluate(()=>document.fonts.ready);
 await page.locator(`[data-preset="${s.kind}"]`).click();
 await page.locator('[data-message]').nth(s.index).click();
 await page.waitForFunction(()=>window.jrisc.vm.decisions.length===1 && window.jrisc.vm.pc===5);
 await page.addStyleTag({content:css});
 await page.evaluate(({s,n})=>{
  const root=document.createElement('div');root.id='twitter-stage';
  root.innerHTML=`<div class="brandline"><b>JRISC</b><span>JEV / INSTRUCTION SET</span></div><h1 class="video-title"></h1><p class="video-message"></p><div id="video-answers"></div><div class="video-code"></div><div class="video-caption"></div><div class="video-note">REAL VM · FIXED DEMO RESPONSES · NO LIVE INFERENCE</div><div class="video-progress"></div>`;
  document.body.append(root);
  root.querySelector('h1').append(document.createTextNode(s.title));const em=document.createElement('em');em.textContent=s.accent;root.querySelector('h1').append(em);
  root.querySelector('.video-message').textContent=document.getElementById('message').value;
  root.querySelector('.video-code').textContent=s.code;root.querySelector('.video-caption').textContent=s.caption;root.querySelector('.video-progress').style.width=((n+1)/6*100)+'%';
  root.append(document.querySelector('.display-panel'));root.querySelector('#video-answers').append(document.getElementById('decisions'));
 },{s,n});
 await page.waitForTimeout(250);
 const start=Date.now();
 if(s.next!==undefined){
  await page.waitForTimeout(1050);
  await page.evaluate(i=>{const b=document.querySelectorAll('[data-message]')[i];b.click();document.querySelector('.video-message').textContent=b.dataset.message;},s.next);
  await page.waitForFunction(()=>window.jrisc.vm.decisions.length===2 && window.jrisc.vm.pc===5);
 }
 await page.waitForTimeout(Math.max(0,s.seconds*1000-(Date.now()-start)));
 await page.screenshot({path:`${out}/${s.id}.png`});
 const state=await page.evaluate(()=>window.jrisc.vm.export());await writeFile(`${out}/${s.id}-trace.json`,JSON.stringify(state,null,2));
 const video=page.video();await context.close();await rename(await video.path(),`${out}/${s.id}.webm`);
 if(apiCalls||errors.length)throw Error(JSON.stringify({apiCalls,errors}));
 const duration=Number(execFileSync(ffprobe,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',`${out}/${s.id}.webm`],{encoding:'utf8'}));
 manifest.push({...s,trimStart:Math.max(0,duration-s.seconds-.1),apiCalls});console.log(`Captured ${s.id}`);
}
await browser.close();await writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
for(const s of manifest){
 execFileSync(ffmpeg,['-y','-ss',String(s.trimStart),'-i',`${out}/${s.id}.webm`,'-t',String(s.seconds),'-vf','fps=30,format=yuv420p','-an','-c:v','libx264','-preset','fast','-crf','19','-movflags','+faststart',`${out}/${s.id}.mp4`],{stdio:'pipe'});
}
await writeFile(`${out}/concat.txt`,manifest.map(s=>`file '${s.id}.mp4'`).join('\n'));
execFileSync(ffmpeg,['-y','-f','concat','-safe','0','-i',`${out}/concat.txt`,'-c','copy','-movflags','+faststart','artifacts/jrisc-twitter.mp4'],{stdio:'pipe'});
execFileSync(ffmpeg,['-y','-ss','1','-i','artifacts/jrisc-twitter.mp4','-frames:v','1','artifacts/jrisc-twitter-cover.png'],{stdio:'pipe'});
console.log('Created artifacts/jrisc-twitter.mp4');
