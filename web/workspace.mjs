// UI view state only. Panels keep their original controls and event handlers alive.
export function bindTabs(nav){
 const tabs=[...nav.querySelectorAll('[role=tab]')];
 function select(id,focus=false){const target=tabs.find(t=>t.getAttribute('aria-controls')===id);if(!target)return;for(const t of tabs){const active=t===target;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!active;}if(focus)target.focus();}
 nav.addEventListener('click',ev=>{const t=ev.target.closest('[role=tab]');if(t)select(t.getAttribute('aria-controls'));});
 nav.addEventListener('keydown',ev=>{const i=tabs.indexOf(document.activeElement);if(i<0)return;const n=ev.key==='Home'?0:ev.key==='End'?tabs.length-1:ev.key==='ArrowRight'?(i+1)%tabs.length:ev.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:null;if(n!==null){ev.preventDefault();select(tabs[n].getAttribute('aria-controls'),true);}});
 select(tabs.find(t=>t.getAttribute('aria-selected')==='true')?.getAttribute('aria-controls')??tabs[0].getAttribute('aria-controls'));return {select};
}
export function initWorkspace(){return {library:bindTabs(document.getElementById('library-tabs')),inspector:bindTabs(document.getElementById('inspector-tabs'))};}
