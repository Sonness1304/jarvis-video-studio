// Own QA project only; no inference/export, no changes to user tabs or projects.
async page=>{
 const checks=[],reports=[];
 await page.goto('http://127.0.0.1:20130/');
 // Initial openProject selects the scene tab asynchronously; wait until it finishes.
 await page.locator('#preview-frame').waitFor({state:'visible'});
 await page.locator('#library-tab-projects').click();await page.locator('#new').click();
 await page.locator('[data-template="knowledge-map"]').click();
 const title='P5 layout QA '+Date.now();
 await page.locator('#create-form [name=title]').fill(title);
 await page.locator('#create-form button[type=submit]').click();
 await page.waitForFunction(t=>document.getElementById('project-title').textContent===t,title);
 await page.locator('#remove').click();await page.locator('#remove').click();
 await page.locator('#scene-heading').fill('Kiểm chứng bố cục');await page.locator('#scene-heading').blur();
 await page.locator('#narration').fill('Viết một ý rõ ràng.\nKiểm tra trước khi dùng.');await page.locator('#narration').blur();
 await page.locator('#open-storyboard').click();await page.locator('#generate-shots').click();
 for(let i=0;i<2;i++){
  await page.locator('[data-shot-select="'+i+'"]').click();
  await page.locator('#shot-title').fill('Ý chính '+(i+1));await page.locator('#shot-title').blur();
  await page.locator('#shot-layout').selectOption('diagram');
  await page.locator('#shot-body').fill('Nội dung ngắn, rõ.');await page.locator('#shot-body').blur();
  await page.locator('#shot-items').fill('Yêu cầu\nBản nháp\nKiểm chứng');await page.locator('#shot-items').blur();
 }
 await page.locator('#close-storyboard').click();
 await page.evaluate(()=>{window.__p5Reports=[];addEventListener('message',ev=>{if(ev.source===document.getElementById('preview-frame').contentWindow&&ev.data?.type==='layout-report')window.__p5Reports.push(ev.data);});});
 async function preview(){
  const response=page.waitForResponse(r=>r.url().endsWith('/api/preview')&&r.request().method()==='POST');
  await page.locator('#preview').click();const p=await(await response).json();
  const path=new URL(p.url,'http://127.0.0.1:20130').pathname;
  await page.waitForFunction(path=>window.__p5Reports.some(r=>r.previewPath===path),path);
  const report=await page.evaluate(path=>window.__p5Reports.find(r=>r.previewPath===path),path);
  const frame=page.frames().find(f=>f.url().endsWith(p.url));if(!frame)throw Error('NO_FRAME');
  const state=await frame.evaluate(()=>({fonts:document.fonts.status,active:[...document.querySelectorAll('[data-shot-id]')].filter(e=>!e.hidden).length}));
  if(state.fonts!=='loaded'||state.active!==1)throw Error('FONT_OR_HIDDEN_STATE');
  reports.push({path,issues:report.issues,summary:await page.locator('#quality-summary').textContent(),...state});
  return {path,report,frame};
 }
 await page.locator('#inspector-tab-video').click();
 let oldPath;
 for(const format of ['portrait','landscape']){
  await page.locator('#format').selectOption(format);const p=await preview();
  if(p.report.issues.length)throw Error('CLEAN_'+format+':'+JSON.stringify(p.report.issues));
  if(!(await page.locator('#quality-summary').textContent()).startsWith('Đã đo khung chữ'))throw Error('REPORT_NOT_DISPLAYED');
  oldPath??=p.path;checks.push(format+'-font-ready-clean-report');
 }
 const summary=await page.locator('#quality-summary').textContent();
 const frame=page.frames().find(f=>f.url().includes('/preview/'));
 await frame.evaluate(path=>parent.postMessage({type:'layout-report',previewPath:path,issues:['STALE_REPORT_SENTINEL']},'*'),oldPath);
 await page.waitForTimeout(150);
 if(await page.locator('#quality-summary').textContent()!==summary)throw Error('STALE_REPORT_ACCEPTED');
 checks.push('stale-preview-report-ignored');
 await page.locator('#inspector-tab-scene').click();await page.locator('#open-storyboard').click();
 await page.locator('[data-shot-select="0"]').click();await page.locator('#shot-layout').selectOption('quote');
 await page.locator('#shot-body').fill('W'.repeat(180));await page.locator('#shot-body').blur();
 await page.locator('#close-storyboard').click();const crowded=await preview();
 if(!crowded.report.issues.some(v=>v.includes('nội dung quá dày')||v.includes('chữ vượt khung')))throw Error('OVERFLOW_NOT_DETECTED');
 if(!(await page.locator('#quality-summary').textContent()).startsWith('Cần xem bố cục:'))throw Error('WARNING_NOT_DISPLAYED');
 await page.screenshot({path:'outputs/p5-pilot/layout-warning-live.png'});checks.push('valid-max-text-overflow-warning');
 await page.locator('#undo').click();await page.locator('#undo').click();
 await page.locator('#inspector-tab-video').click();await page.locator('#format').selectOption('portrait');
 await page.locator('#save').click();await page.waitForFunction(()=>document.getElementById('draft-status').textContent.startsWith('Đã lưu'));
 const restored=await preview();if(restored.report.issues.length)throw Error('RESTORE_NOT_CLEAN');
 await page.screenshot({path:'outputs/p5-pilot/layout-clean-live.png'});checks.push('undo-restores-clean-preview');
 return {status:'VERIFIED',checks,reports,projectTitle:title,mediaApiRequests:0};
}
