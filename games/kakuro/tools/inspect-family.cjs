'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path');
const output=path.join(__dirname,'../docs/evidence/family');
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true});
  const report=[];
  try {
    for(const [name,url] of [
      ['xox','https://defterde.com/oyunlar/xox/'],
      ['sayibulma','https://defterde.com/oyunlar/sayibulma/'],
      ['dokuztas','https://defterde.com/oyunlar/dokuztas/'],
      ['kakuro-before','http://127.0.0.1:4178/']
    ]) {
      if(process.env.REFERENCES_ONLY==='1'&&name==='kakuro-before')continue;
      const page=await browser.newPage({viewport:{width:1280,height:900}});
      await page.goto(url,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      if(name!=='kakuro-before')await page.waitForTimeout(3000);
      const evidence=await page.evaluate(()=>{
        const info=selector=>[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length).slice(0,8).map(el=>{
          const s=getComputedStyle(el),r=el.getBoundingClientRect();
          return {tag:el.tagName,class:el.className,text:el.textContent.trim().slice(0,60),font:s.fontFamily,size:s.fontSize,color:s.color,background:s.backgroundColor,width:r.width,height:r.height};
        });
        return {title:document.title,body:info('body'),heading:info('h1'),paper:info('.sayfa,.paper,.sheet'),controls:info('button'),
          styles:[...document.styleSheets].map(s=>s.href),fonts:[...document.fonts].map(f=>({family:f.family,status:f.status}))};
      });
      await page.screenshot({path:path.join(output,`${name}-desktop.png`),fullPage:true});
      await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);
      await page.screenshot({path:path.join(output,`${name}-mobile.png`),fullPage:true});
      report.push({name,url,...evidence});await page.close();
    }
    fs.writeFileSync(path.join(output,'live-reference.json'),JSON.stringify({date:new Date().toISOString(),sources:report},null,2));
    console.log(report.map(r=>({name:r.name,heading:r.heading,body:r.body,styles:r.styles})));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
