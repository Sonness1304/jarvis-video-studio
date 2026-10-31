import {contentRecipes,previewRecipe,applyRecipe,undoRecipe} from './content-recipes.mjs';
import {contentStructures} from './content-model.mjs';
const fieldLabels={audience:'Người xem',goal:'Mục tiêu',structure:'Mạch kể',targetSeconds:'Thời lượng mục tiêu'};
const display=(field,value)=>field==='structure'?contentStructures.find(s=>s.id===value)?.name??value:field==='targetSeconds'?value+' giây':value||'Chưa điền';
export function initRecipePicker({parent,getSession,changed,refresh}){
 const box=document.createElement('details');box.className='content-recipes';
 box.innerHTML='<summary>Công thức viết bài <span>6 cách bắt đầu</span></summary><label for="content-recipe">Chọn công thức</label><select id="content-recipe"></select><p class="content-hint">Xem các trường sẽ đổi bên dưới. Chủ đề, nguồn và các cảnh được giữ nguyên.</p><div id="content-recipe-diff" class="recipe-diff"></div><div class="recipe-actions"><button id="content-recipe-apply" type="button">Điền brief theo mẫu</button><button id="content-recipe-undo" type="button" hidden>Hoàn tác điền mẫu</button></div><p id="content-recipe-status" role="status" class="content-hint"></p>';
 parent.prepend(box);
 const select=box.querySelector('select'),diff=box.querySelector('#content-recipe-diff'),apply=box.querySelector('#content-recipe-apply'),undo=box.querySelector('#content-recipe-undo'),status=box.querySelector('#content-recipe-status');
 const states=new WeakMap();const local=s=>{if(!states.has(s))states.set(s,{selected:'',undo:null,note:''});return states.get(s);};
 select.add(new Option('Chọn để xem trước',''));for(const recipe of contentRecipes)select.add(new Option(recipe.name,recipe.id));
 function render(){const s=getSession();if(!s)return;const l=local(s);select.value=l.selected;diff.replaceChildren();let count=0;
  if(l.selected){const preview=previewRecipe(s.board.contentBrief,l.selected);count=preview.changes.length;
   for(const change of preview.changes){const row=document.createElement('div'),label=document.createElement('strong'),before=document.createElement('p'),after=document.createElement('p');label.textContent=fieldLabels[change.field];before.textContent='Hiện tại: '+display(change.field,change.before);after.textContent='Theo mẫu: '+display(change.field,change.after);row.append(label,before,after);diff.append(row);}
  }
  select.disabled=!!s.pending;apply.disabled=!!s.pending||!count;undo.hidden=!l.undo;undo.disabled=!!s.pending;status.textContent=l.note||(!l.selected?'Chọn một công thức để xem trước.':count?'Chỉ đổi brief khi bấm Điền brief theo mẫu.':'Brief đã có các giá trị của mẫu này.');
 }
 select.onchange=()=>{const s=getSession();if(!s||s.pending)return;const l=local(s);l.selected=select.value;l.note='';render();};
 apply.onclick=()=>{const s=getSession();if(!s||s.pending)return;const l=local(s);if(!l.selected)return;
  const result=applyRecipe(s.board.contentBrief,l.selected);s.board.contentBrief=result.brief;l.undo=result.undo;l.note='Đã điền brief. Bạn có thể sửa tiếp hoặc hoàn tác; chưa gọi Claude.';changed();refresh();render();
 };
 undo.onclick=()=>{const s=getSession();if(!s||s.pending)return;const l=local(s);if(!l.undo)return;
  try{s.board.contentBrief=undoRecipe(s.board.contentBrief,l.undo);l.undo=null;l.note='Đã khôi phục các trường trước khi điền mẫu.';changed();refresh();}
  catch{l.note='Bạn đã sửa thêm trường của brief. Giữ nguyên bản chỉnh hiện tại; hoàn tác mẫu không ghi đè phần bạn vừa sửa.';}
  render();
 };
 return {render};
}
