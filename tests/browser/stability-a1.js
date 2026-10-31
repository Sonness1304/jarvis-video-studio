// Dedicated scratch server/project catalog; no production project or render action.
async page=>{
 const url=new URL(page.url()).origin;if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(url))throw Error('SCRATCH_URL_REQUIRED');
 await page.setViewportSize({width:1280,height:800});await page.goto(url);await page.locator('#project-page').waitFor({state:'attached'});await page.waitForFunction(()=>document.querySelector('#project-count').textContent.includes('201'));
 await page.locator('#library-tab-projects').click();
 if(await page.locator('[data-project]').count()!==24)throw Error('PAGE_SIZE');
 if(!(await page.locator('[data-project]').first().getAttribute('data-project')==='p0200'))throw Error('NEWEST_HIDDEN');
 if(await page.locator('#project-page').textContent()!=='1 / 9')throw Error('PAGE_COUNT');
 await page.locator('#project-next').click();if(await page.locator('#project-page').textContent()!=='2 / 9')throw Error('NEXT');
 await page.locator('#project-prev').click();if(await page.locator('#project-page').textContent()!=='1 / 9')throw Error('PREVIOUS');
 await page.locator('#project-search').fill('p0000');if(await page.locator('[data-project]').count()!==1||await page.locator('[data-project]').getAttribute('data-project')!=='p0000')throw Error('GLOBAL_SEARCH');
 if(await page.locator('#project-page').textContent()!=='1 / 1')throw Error('SEARCH_PAGE_RESET');
 await page.locator('#project-search').fill('does-not-exist');if(await page.locator('[data-project]').count()!==0||!await page.locator('#project-next').isDisabled())throw Error('EMPTY_SEARCH');
 await page.locator('#project-search').fill('');await page.setViewportSize({width:390,height:844});if(await page.locator('#project-page').textContent()!=='1 / 9')throw Error('RESET_SEARCH');
 await page.locator('#project-next').click();if(await page.locator('#project-page').textContent()!=='2 / 9')throw Error('MOBILE_NEXT');await page.locator('#project-prev').click();
 return {status:'VERIFIED',projects:201,pageSize:24,pages:9,checks:['newest-visible','next-previous','global-search','empty-search','search-reset','mobile-next-previous']};
}
