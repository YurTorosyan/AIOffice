// Run inside the pinned ARMGARAGE QA image; synthetic HTML only, no project build or Codex.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '/opt/qa/node_modules/playwright/index.mjs';
import {verifyArmgarageIdentity} from '/opt/qa/browser-contract.mjs';

test('header identity and Russian H1 follow the product specification at all required widths',async()=>{
 const browser=await chromium.launch({headless:true,chromiumSandbox:true});
 try{
  const page=await browser.newPage();
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:1000});
   for(const heading of ['Сервис, где решение начинается с диагностики','Диагностика и обслуживание автомобиля']){
    await page.setContent(`<header><a href="#top" aria-label="ARMGARAGE — главная">ARM<span>GARAGE</span></a></header><main><h1>${heading}</h1></main>`);
    await verifyArmgarageIdentity(page);
    assert.equal(await page.locator('h1').innerText(),heading);
   }
  }
 }finally{await browser.close();}
});

test('missing brand, missing H1, blank H1 and hidden H1 still fail acceptance',async()=>{
 const browser=await chromium.launch({headless:true,chromiumSandbox:true});
 try{
  const page=await browser.newPage();
  for(const html of [
   '<header>Другой сервис</header><main><h1>Диагностика автомобиля</h1></main>',
   '<header>ARMGARAGE</header><main><h2>Диагностика автомобиля</h2></main>',
   '<header>ARMGARAGE</header><main><h1>   </h1></main>',
   '<header>ARMGARAGE</header><main><h1 hidden>Диагностика автомобиля</h1></main>',
  ]){await page.setContent(html);await assert.rejects(()=>verifyArmgarageIdentity(page));}
 }finally{await browser.close();}
});
