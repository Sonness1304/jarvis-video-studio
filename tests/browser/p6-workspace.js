// Own synthetic QA project/media, dedicated temporary browser. No user project writes.
async page=>{
 const checks=[],title='P6 nhịp kể '+Date.now();
 if((await page.locator('#project-title').textContent()).startsWith('P6 nhịp kể ')&&(await page.locator('#draft-status').textContent()).startsWith('Chưa lưu')){await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('draft-status').textContent.startsWith('Đã lưu'));}
 await page.goto('http://127.0.0.1:20130/');await page.locator('#preview-frame').waitFor({state:'visible'});
 if(!await page.locator('#snap-phrases').isVisible())throw Error('P6_NOT_LOADED');
 await page.locator('#library-tab-projects').click();await page.locator('#new').click();await page.locator('[data-template="listicle"]').click();
 await page.locator('#create-form [name=title]').fill(title);await page.locator('#create-form button[type=submit]').click();await page.waitForFunction(t=>document.getElementById('project-title').textContent===t,title);
 await page.locator('#remove').click();await page.locator('#remove').click();
 await page.locator('#scene-heading').fill('Chỉnh hình, giữ lời kể');await page.locator('#scene-heading').blur();
 await page.locator('#narration').fill('Hình ảnh có thể đổi nhịp.\nLời kể vẫn giữ nguyên.');await page.locator('#narration').blur();
 await page.locator('#library-tab-media').click();await page.locator('#asset-rights').fill('Clip synthetic do coordinator tự tạo bằng FFmpeg testsrc2 cho QA local.');await page.locator('#asset-file').setInputFiles('./outputs/p6-pilot/source-motion.mp4');
 await page.waitForFunction(()=>document.getElementById('upload-status').textContent==='Đã nhập và kiểm tra media.');
 await page.locator('#asset-search').fill('source-motion');await page.locator('#asset-list [data-attach]').first().click();
 await page.locator('#inspector-tab-scene').click();await page.locator('#media-fit').selectOption('contain');
 async function openTrim(){await page.locator('#open-trim').click();await page.locator('#trim-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>document.getElementById('source-video').readyState>=1);}
 async function range(id,value){await page.locator('#'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input'));},value);}
 await openTrim();await range('trim-in',1);await range('trim-out',9);await page.locator('#cancel-trim').click();
 if(Number(await page.locator('#clip-start').inputValue())!==0)throw Error('CANCEL_MUTATED');checks.push('trim-cancel-no-mutation');
 await openTrim();await range('source-cursor',2);await page.waitForFunction(()=>Math.abs(document.getElementById('source-video').currentTime-2)<.06);
 await range('trim-in',1);await range('trim-out',9);await page.screenshot({path:'outputs/p6-pilot/cut-desk.png'});await page.locator('#apply-trim').click();
 if(Number(await page.locator('#clip-start').inputValue())!==1||Number(await page.locator('#clip-end').inputValue())!==9)throw Error('TRIM_COMMIT');
 await page.locator('#undo').click();if(Number(await page.locator('#clip-start').inputValue())!==0)throw Error('TRIM_NOT_ONE_UNDO');await page.locator('#redo').click();checks.push('source-seek-trim-atomic-undo-redo');
 await openTrim();await page.evaluate(()=>document.getElementById('undo').click());await page.locator('#apply-trim').click();
 if(!(await page.locator('#message').textContent()).includes('Cảnh hoặc bản lưu đã đổi'))throw Error('STALE_APPLY_ACCEPTED');
 await page.locator('#cancel-trim').click();await page.locator('#redo').click();checks.push('dialog-stale-generation-rejected');
 await page.locator('#preview').click();await page.waitForFunction(()=>document.querySelectorAll('[data-phrase-time]').length===2);
 const p=Number(await page.locator('[data-phrase-time]').nth(1).getAttribute('data-phrase-time'));
 await range('scrub',p+.005);if(Math.abs(Number(await page.locator('#scrub').inputValue())-p)>.018)throw Error('SNAP_WRONG');
 await page.locator('#phrase-prev').click();if(Number(await page.locator('#scrub').inputValue())>=p-.02)throw Error('PREVIOUS_MARKER');
 await page.locator('#phrase-next').click();checks.push('draft-snap-marker-navigation');
 await page.locator('#tail-hold').evaluate(e=>{e.value='0.5';e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'));});
 await page.locator('#undo').click();checks.push('hold-atomic-undo');
 await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('draft-status').textContent.startsWith('Đã lưu'));
 const record=await page.evaluate(async title=>{const row=(await(await fetch('/api/projects')).json()).find(p=>p.title===title);return(await fetch('/api/projects/'+row.id)).json();},title);
 await page.setViewportSize({width:390,height:844});await page.locator('#open-trim').click();await page.locator('#trim-dialog').waitFor({state:'visible'});await page.screenshot({path:'outputs/p6-pilot/cut-mobile.png',fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('MOBILE_OVERFLOW');await page.locator('#cancel-trim').click();await page.setViewportSize({width:1440,height:1000});checks.push('mobile390-cutdesk');
 return {status:'VERIFIED',checks,projectId:record.brief.id,revision:record.revision,brief:record.brief};
}
