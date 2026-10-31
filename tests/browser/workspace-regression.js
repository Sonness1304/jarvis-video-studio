// Run with pinned playwright-cli run-code --filename=tests/browser/workspace-regression.js
// Read-only response fixtures on a dedicated profile; never click resume or mutate stored metadata.
async page=>{
 let ids=[];
 await page.route('**/api/bootstrap',async route=>{const response=await route.fetch(),data=await response.json();ids=data.projects.slice(0,2).map(p=>p.id);if(ids.length!==2)throw Error('NEED_TWO_PROJECTS');data.projects=data.projects.map(p=>({...p,title:'Hai dự án trùng tên'}));await route.fulfill({response,json:data});});
 await page.route('**/api/batches',async route=>{if(route.request().method()!=='GET')return route.continue();await route.fulfill({json:ids.map((id,i)=>({id:'batch-read-fixture-'+i,projectId:id,projectRevision:1,status:'PAUSED',entries:[]}))});});
 try{await page.goto('http://127.0.0.1:20130/');await page.locator('[data-batch-id="batch-read-fixture-1"]').waitFor({state:'visible'});for(let i=0;i<2;i++){const row=page.locator('[data-batch-id="batch-read-fixture-'+i+'"]');if(!(await row.textContent()).includes(ids[i]))throw Error('DUPLICATE_BATCH_TITLE_AMBIGUOUS');}await page.locator('#library-tab-projects').click();for(const id of ids){if(!(await page.locator('[data-project="'+id+'"]').textContent()).includes(id))throw Error('DUPLICATE_PROJECT_TITLE_AMBIGUOUS');}return {status:'VERIFIED',checks:['duplicate-titles-keep-visible-project-identity','global-paused-batches-retained']};}
 finally{await page.unroute('**/api/bootstrap');await page.unroute('**/api/batches');await page.goto('http://127.0.0.1:20130/');}
}
