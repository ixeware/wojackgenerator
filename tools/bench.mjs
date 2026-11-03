import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { serve } from '../engine/server.mjs';
import { synthesize } from '../engine/tts.mjs';
import { resolvePapers } from '../engine/pubmed.mjs';
import { buildTimeline } from '../engine/timeline.mjs';
const R=new URL('..', import.meta.url).pathname.replace(/\/$/,'');
const e=JSON.parse(await readFile(R+'/episodes/nsaids-growth-plates.json','utf8'));
const a=JSON.parse(await readFile(R+'/assets/manifest.json','utf8'));
const blocks=await synthesize(e.script,e.voice,R+'/cache/tts');
const papers=await resolvePapers(e.papers,R+'/cache/pubmed');
const tl=buildTimeline({...e,papers},blocks); tl.papers=papers; tl.mouth=new Array(tl.meta.frames).fill(1);
const {server,port}=await serve(R);
const b=await chromium.launch({args:['--no-sandbox','--disable-gpu','--force-color-profile=srgb']});
const pg=await b.newPage({viewport:{width:1080,height:1920}});
await pg.goto(`http://127.0.0.1:${port}/engine/stage/index.html`,{waitUntil:'networkidle'});
await pg.evaluate(async ({t,a})=>window.wg.setup(t,a),{t:tl,a});
await pg.waitForFunction(()=>window.wg?.ready);
const clip={x:0,y:0,width:1080,height:1920};
const frames=[Math.round(3*30),Math.round(33*30),Math.round(95*30)];
for (const mode of ['png','jpeg']) {
  let te=0,ts=0,n=0;
  for (const f of frames) for (let k=0;k<4;k++){ const fi=f+k;
    let t0=performance.now(); await pg.evaluate(n=>window.wg.frame(n),fi); te+=performance.now()-t0;
    t0=performance.now(); await pg.screenshot({clip, type:mode, ...(mode==='jpeg'?{quality:92}:{})}); ts+=performance.now()-t0; n++; }
  console.log(mode,'evaluate',(te/n).toFixed(0)+'ms','screenshot',(ts/n).toFixed(0)+'ms');
}
// effect of filters: disable all CSS filters
await pg.addStyleTag({content:'.spr{filter:none!important}'});
let te=0,ts=0,n=0;
for (const f of frames) for (let k=0;k<4;k++){ const fi=f+k;
  let t0=performance.now(); await pg.evaluate(n=>window.wg.frame(n),fi); te+=performance.now()-t0;
  t0=performance.now(); await pg.screenshot({clip,type:'jpeg',quality:92}); ts+=performance.now()-t0; n++; }
console.log('jpeg, no filters: evaluate',(te/n).toFixed(0)+'ms','screenshot',(ts/n).toFixed(0)+'ms');
await b.close(); server.close();
