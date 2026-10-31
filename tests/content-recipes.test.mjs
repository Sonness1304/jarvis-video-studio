import test from 'node:test';
import assert from 'node:assert/strict';
import {contentRecipes,previewRecipe,applyRecipe,undoRecipe} from '../web/content-recipes.mjs';
import {validateContentBrief} from '../web/content-model.mjs';
const brief=()=>({subject:'Camera: câu chuyện của tôi',audience:'Tự chọn',goal:'Giữ nguyên nếu chưa áp dụng',targetSeconds:45,structure:'explain',sourceNotes:'Dữ liệu riêng\nhttps://example.com/?a=1&b=2'});
test('six recipes fit existing contract; preview never changes brief and only proposes four fields',()=>{
 assert.equal(contentRecipes.length,6);assert.equal(new Set(contentRecipes.map(r=>r.id)).size,6);
 for(const recipe of contentRecipes){const b=Object.freeze(brief()),before=JSON.stringify(b),preview=previewRecipe(b,recipe.id);
  assert.ok(preview.changes.length>=3);assert.ok(preview.changes.every(x=>['audience','goal','structure','targetSeconds'].includes(x.field)));
  assert.equal(JSON.stringify(b),before);const {brief:next}=applyRecipe(b,recipe.id);validateContentBrief(next);
  assert.equal(next.subject,b.subject);assert.equal(next.sourceNotes,b.sourceNotes);assert.equal(JSON.stringify(b),before);
 }
 assert.throws(()=>previewRecipe(brief(),'unknown'),/RECIPE_NOT_FOUND/);
});
test('undo restores touched fields and retains subsequent subject and source edits',()=>{
 const original=brief(),result=applyRecipe(original,contentRecipes[0].id),current={...result.brief,subject:'Chủ đề mới',sourceNotes:'Nguồn mới'};
 const restored=undoRecipe(current,result.undo);assert.deepEqual(restored,{...original,subject:current.subject,sourceNotes:current.sourceNotes});
 assert.deepEqual(result.brief,applyRecipe(original,contentRecipes[0].id).brief);
});
test('undo rejects subsequent touched-field edits without losing user changes; second recipe has own snapshot',()=>{
 const first=applyRecipe(brief(),contentRecipes[0].id),edited={...first.brief,goal:'Tôi vừa chỉnh'};
 assert.throws(()=>undoRecipe(edited,first.undo),/RECIPE_UNDO_STALE/);assert.equal(edited.goal,'Tôi vừa chỉnh');
 const second=applyRecipe(edited,contentRecipes[1].id);assert.deepEqual(undoRecipe(second.brief,second.undo),edited);
 assert.equal(previewRecipe(second.brief,contentRecipes[1].id).changes.length,0);
});
test('recipe fill works while subject is unfinished; undo restores an unfinished field without discarding it',()=>{
 const draft={...brief(),subject:'',targetSeconds:0},result=applyRecipe(draft,contentRecipes[0].id);
 assert.equal(result.brief.subject,'');assert.equal(result.brief.targetSeconds,110);assert.deepEqual(undoRecipe(result.brief,result.undo),draft);
});
