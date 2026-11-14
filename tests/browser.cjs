const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');
 await page.locator('#task-input').fill('Проверить API');await page.locator('#task-input').press('Enter');
 assert.equal(await page.locator('.task').count(),1);
 await page.getByRole('checkbox').check();await page.reload();assert.equal(await page.getByRole('checkbox').isChecked(),true);
 await page.getByRole('button',{name:'В работе',exact:true}).click();assert.equal(await page.locator('.task').count(),0);
 await page.getByRole('button',{name:'Готово',exact:true}).click();assert.equal(await page.locator('.task').count(),1);
 await page.locator('#task-input').fill('<img src=x onerror=alert(1)>');await page.locator('#task-input').press('Enter');assert.equal(await page.locator('.task img').count(),0);assert.equal(await page.locator('.task').count(),2);
 await page.getByRole('button',{name:'Удалить задачу: Проверить API',exact:true}).click();await page.reload();assert.equal(await page.locator('.task').count(),1);
 await page.locator('#task-input').fill('   ');await page.locator('#task-input').press('Enter');assert.equal(await page.locator('.task').count(),1);
 // Real DOM/localStorage failure paths.
 await page.evaluate(()=>localStorage.setItem('quiet-list:v1','{'));await page.reload();assert.equal(await page.locator('.task').count(),0);assert.match(await page.locator('#notice').textContent(),/Не удалось/);
 await page.locator('#task-input').fill('Собрать идеи для проекта');await page.locator('#task-input').press('Enter');
 for(const text of ['Создать первый прототип','Проверить мобильную версию']){await page.locator('#task-input').fill(text);await page.locator('#task-input').press('Enter')}
 await page.getByRole('checkbox').first().check();await page.screenshot({path:'tests/desktop.png',fullPage:true});
 await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);await page.screenshot({path:'tests/mobile.png',fullPage:true});
 // Other tab writes are reflected.
 const other=await page.context().newPage();await other.goto('http://127.0.0.1:4173');await other.evaluate(()=>localStorage.removeItem('quiet-list:v1'));await page.waitForFunction(()=>document.querySelectorAll('.task').length===0);await other.close();
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('quota')}});await page.locator('#task-input').fill('Не потерять предупреждение');await page.locator('#task-input').press('Enter');assert.match(await page.locator('#notice').textContent(),/Не удалось сохранить/);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: add, complete, persistence, filters, XSS, delete persistence, whitespace, malformed storage, mobile overflow, multi-tab sync, storage failure, no page errors');
})().catch(e=>{console.error(e);process.exit(1)});
