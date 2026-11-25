const { test, expect } = require('@playwright/test');

async function open(page, n = 8, iki = true) {
  await page.addInitScript(iki => localStorage.setItem('sos-ayar', JSON.stringify({ ikiKisi: iki, fazlaTur: true, zorluk: 'zor', ipucu: false })), iki);
  await page.route('**/config.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('boyut: 8', `boyut: ${n}`).replace('dusunmeMs: [400, 800]', 'dusunmeMs: [30, 30]') });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.SOS?.durum && !SOS.durum.kilit);
}
async function ready(page) { await page.waitForFunction(() => !SOS.durum.kilit && !SOS.durum.gecis); }
async function move(page, i, harf = 'S') {
  await page.locator(`#harf-${harf.toLowerCase()}`).click();
  await page.locator(`.hucre[data-i="${i}"]`).click();
  await ready(page);
}

const screens = [[320,568],[375,500],[390,844],[568,320],[500,375],[844,390],[667,375],[768,1024],[1024,768],[1440,900]];
for (const n of [5,6,7,8,9,10,11,12]) test(`geometry ${n}×${n}`, async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await open(page, n);
  for (const [width, height] of screens) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(([w,h]) => {
      const y = SOS.layout.hesapla(w,h,SOS.durum.n);
      return y.mod === SOS.durum.yerlesim.mod && y.board === SOS.durum.yerlesim.board;
    }, [width,height]);
    const result = await page.evaluate(() => {
      const rect = el => { const r=el.getBoundingClientRect(); return { x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height }; };
      const board=rect(document.querySelector('#tahta-kutu'));
      const controls=[...document.querySelectorAll('.harf-dugme,.dugmeler button,.ayar')].map(el=>({id:el.id||el.textContent,...rect(el),font:parseFloat(getComputedStyle(el).fontSize)}));
      const cells=[...document.querySelectorAll('.hucre')].map(rect);
      const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
      return { board, controls, minCell:Math.min(...cells.map(c=>Math.min(c.w,c.h))), overlaps:controls.flatMap((a,i)=>controls.slice(i+1).filter(b=>overlap(a,b)).map(b=>[a.id,b.id])), boardOverlap:controls.filter(c=>overlap(board,c)), scroll:SOS.durum.yerlesim.kaydir, docW:document.documentElement.scrollWidth,docH:document.documentElement.scrollHeight };
    });
    const label=`${n}, ${width}×${height}`;
    expect(result.docW,label).toBeLessThanOrEqual(width+1);
    expect(result.minCell,label).toBeGreaterThanOrEqual(23.9);
    expect(result.overlaps,label).toEqual([]); expect(result.boardOverlap,label).toEqual([]);
    for(const c of result.controls) { expect(c.w,label+c.id).toBeGreaterThanOrEqual(43.9); expect(c.h,label+c.id).toBeGreaterThanOrEqual(43.9); if(!c.id.startsWith('harf-') && c.id !== 'ses-dugme') expect(c.font,label+c.id).toBeGreaterThanOrEqual(16); }
    if(!result.scroll) {
      expect(result.docH,label).toBeLessThanOrEqual(height+1);
      for(const r of [result.board,...result.controls]) { expect(r.x,label).toBeGreaterThanOrEqual(0);expect(r.y,label).toBeGreaterThanOrEqual(0);expect(r.right,label).toBeLessThanOrEqual(width+.5);expect(r.bottom,label).toBeLessThanOrEqual(height+.5); }
    }
  }
  expect(errors).toEqual([]);
});

test('keyboard, multi-SOS, undo, rotation and full game', async ({ page }) => {
  await page.setViewportSize({width:375,height:500}); await open(page,5);
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByRole('gridcell')).toHaveCount(25);
  const first=page.getByRole('button',{name:'A1 boş, S yaz',exact:true});
  await first.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('o');
  await expect(page.getByRole('button',{name:'B1 boş, O yaz',exact:true})).toBeFocused();
  await page.keyboard.press('Enter'); await ready(page);
  await expect(page.getByRole('button',{name:'B1: O, mavi',exact:true})).toHaveAttribute('aria-disabled','true');
  await page.locator('#geri-al').click();
  for(const i of [0,2,10,12]) await move(page,i);
  await move(page,6,'O');
  await expect(page.locator('#puan-mavi')).toHaveText('2');
  const before=await page.evaluate(()=>JSON.stringify({d:SOS.durum.durum,h:SOS.durum.gecmis,s:SOS.durum.secili}));
  await page.setViewportSize({width:500,height:375});
  await expect(page.locator('body')).toHaveAttribute('data-duzen','yatay');
  expect(await page.evaluate(()=>JSON.stringify({d:SOS.durum.durum,h:SOS.durum.gecmis,s:SOS.durum.secili}))).toBe(before);
  // Occupied cells cannot consume a turn, even when a synthetic click bypasses aria-disabled.
  await page.locator('.hucre[data-i="6"]').dispatchEvent('click');
  expect(await page.evaluate(()=>SOS.durum.durum.bos)).toBe(20);
  // Two clicks in the same task: the synchronous lock accepts only the first.
  await page.evaluate(()=>{document.querySelector('.hucre[data-i="1"]').click();document.querySelector('.hucre[data-i="3"]').click();});
  await ready(page); expect(await page.evaluate(()=>SOS.durum.durum.bos)).toBe(19);
  for(let i=0;i<25;i++) if(await page.evaluate(i=>SOS.durum.durum.hucre[i]===0,i)) await move(page,i);
  await expect(page.locator('#duyuru')).toContainText(/KAZANDI|BERABERE/);
  await expect(page.locator('#duyuru')).toContainText('Skor:');
  await page.locator('#geri-al').click();
  expect(await page.evaluate(()=>SOS.durum.durum.bitti)).toBe(false);
  await expect(page.locator('.hucre[aria-disabled="false"]')).toHaveCount(1);
});

test('AI response and new page cancels active search', async ({ page }) => {
  await open(page,8,false); await move(page,0);
  expect(await page.evaluate(()=>SOS.durum.durum.bos)).toBe(62);
  await page.locator('#geri-al').click();expect(await page.evaluate(()=>SOS.durum.durum.bos)).toBe(64);
  // Prepare a legal near-end state; the next human move enters the actual 12-empty async search.
  await page.evaluate(()=>{
    let d=SOS.game.yeniOyun({boyut:8,fazlaTur:true});
    for(let i=0;i<51;i++)d=SOS.game.placeLetter(d,Math.floor(i/8),i%8,'S');
    d.sira=0; SOS.durum.durum=d;
    const original=SOS.ai.secAsync;
    SOS.ai.secAsync=(...args)=>{
      window.searchSignal=args[3].signal;
      setTimeout(()=>document.querySelector('#yeni-sayfa').click(),0);
      return original(...args);
    };
  });
  await page.locator('.hucre[data-i="51"]').click();
  await page.waitForFunction(()=>window.searchSignal?.aborted);
  await ready(page);
  expect(await page.evaluate(()=>window.searchSignal.aborted)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>SOS.durum.durum.bos)).toBe(64);
  await page.waitForTimeout(400);
  expect(await page.evaluate(()=>SOS.durum.durum.bos)).toBe(64);
});

test('scroll fallback and rotation rejection', async ({ page }) => {
  await page.setViewportSize({width:320,height:480});await open(page);
  await expect(page.locator('#ekran-notu')).toBeVisible();
  await page.evaluate(()=>{
    document.documentElement.requestFullscreen=()=>Promise.reject(new Error('unavailable'));
  });
  await page.locator('#yatay-oyna').click();
  await expect(page.locator('#ekran-aciklama')).toContainText('elle yan çevir');
  await page.setViewportSize({width:480,height:320});
  await expect(page.locator('#ekran-notu')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-duzen','yatay');
});

test('160 tally marks reflow with separated groups and undo', async ({ page }) => {
  await page.setViewportSize({width:1440,height:1200}); await open(page,12);
  const result=await page.evaluate(async()=>{
    const M=SOS.durum.M,D=SOS.draw;
    for(let i=1;i<=160;i++) await D.ceteleGuncelle(M,[i,0],{anlik:true,adim:0});
    const boxes=M.cizimler[0].map(c=>{const r=c.node.getBBox();return {y:r.y,b:r.y+r.height};});
    const groups=Array.from({length:32},(_,i)=>({top:Math.min(...boxes.slice(i*5,i*5+5).map(r=>r.y)),bottom:Math.max(...boxes.slice(i*5,i*5+5).map(r=>r.b))}));
    await D.ceteleGuncelle(M,[5,0],{anlik:true});
    return {groups,yuk:M.yuk,left:M.cizimler[0].length};
  });
  for(let i=1;i<result.groups.length;i++)expect(result.groups[i].top).toBeGreaterThan(result.groups[i-1].bottom);
  expect(result.groups.at(-1).bottom).toBeLessThan(result.yuk);expect(result.left).toBe(5);
});

test('touch targets play once and keep state when rotated', async ({ browser }) => {
  const context=await browser.newContext({hasTouch:true,viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage();
  try {
    await open(page);
    await page.locator('#harf-o').tap();
    await page.locator('.hucre[data-i="0"]').tap();await ready(page);
    await expect(page.getByRole('button',{name:'A1: O, mavi',exact:true})).toHaveAttribute('aria-disabled','true');
    await page.locator('.hucre[data-i="0"]').dispatchEvent('click');
    expect(await page.evaluate(()=>SOS.durum.durum.bos)).toBe(63);
    await page.setViewportSize({width:844,height:390});
    await expect(page.locator('#harf-o')).toHaveAttribute('aria-pressed','true');
    await page.locator('#ses-dugme').tap();
    await expect(page.locator('#ses-dugme')).toHaveAttribute('aria-pressed','true');
    await page.locator('#geri-al').tap();
    expect(await page.evaluate(()=>SOS.durum.durum.bos)).toBe(64);
  } finally { await context.close(); }
});

test('fallback font, safe insets and dynamic viewport preserve readable controls', async ({page}) => {
  await page.route('**/assets/fonts/**',r=>r.abort());
  await page.setViewportSize({width:667,height:375});await open(page);
  await page.addStyleTag({content:'body { padding: 12px 24px 16px; font-family: sans-serif; }'});
  await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
  await expect.poll(()=>page.evaluate(()=>SOS.durum.yerlesim.pageW)).toBeLessThanOrEqual(619);
  const metrics=await page.locator('.alt-bant').evaluate(el=>({box:el.getBoundingClientRect().toJSON(),overflow:[...el.querySelectorAll('button')].filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.textContent)}));
  expect(metrics.box.right).toBeLessThanOrEqual(643);expect(metrics.box.bottom).toBeLessThanOrEqual(359);expect(metrics.overflow).toEqual([]);
  await page.setViewportSize({width:375,height:500});
  await expect.poll(()=>page.evaluate(()=>SOS.durum.yerlesim.mod)).toBe('dikey');
  expect(await page.evaluate(()=>SOS.durum.durum.bos)).toBe(64);
  expect(await page.locator('meta[name="viewport"]').getAttribute('content')).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/);
});

test('orientation lock uses only an explicit click', async ({page}) => {
  await page.setViewportSize({width:320,height:480});await open(page);
  await page.evaluate(()=>{
    window.rotationCalls=[];
    document.documentElement.requestFullscreen=async()=>{rotationCalls.push('fullscreen');};
    Object.defineProperty(screen,'orientation',{configurable:true,value:{lock:async value=>rotationCalls.push(value)}});
  });
  expect(await page.evaluate(()=>rotationCalls)).toEqual([]);
  await page.locator('#yatay-oyna').click();
  expect(await page.evaluate(()=>rotationCalls)).toEqual(['fullscreen','landscape']);
});

test('normal animations release the board and survive a new page', async ({page}) => {
  await page.emulateMedia({reducedMotion:'no-preference'});await open(page);
  await page.locator('.hucre[data-i="0"]').click();
  await page.locator('#yeni-sayfa').click();await ready(page);
  expect(await page.evaluate(()=>SOS.durum.durum.bos)).toBe(64);
  await move(page,0);expect(await page.evaluate(()=>SOS.durum.durum.bos)).toBe(63);
});

test('classic scripts still start from file URL', async ({page}) => {
  const {pathToFileURL}=require('node:url'),path=require('node:path');
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../index.html')).href);
  await page.waitForFunction(()=>window.SOS?.durum&&!SOS.durum.kilit);
  await expect(page.getByRole('gridcell')).toHaveCount(64);
  await page.locator('.hucre[data-i="0"]').click();await ready(page);
  expect(await page.evaluate(()=>SOS.durum.durum.bos)).toBeLessThan(64);
});

test('arrow navigation reveals focused cells in scroll fallback', async ({page}) => {
  await page.setViewportSize({width:320,height:320});await open(page,12);
  await page.locator('.hucre[data-i="0"]').focus();
  for(let i=0;i<11;i++)await page.keyboard.press('ArrowDown');
  await expect(page.locator('.hucre[data-i="132"]')).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>{
    const r=document.activeElement.getBoundingClientRect();
    return r.top>=0 && r.bottom<=innerHeight;
  })).toBe(true);
});
