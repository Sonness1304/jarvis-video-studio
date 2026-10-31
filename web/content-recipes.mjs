import {validateContentBrief} from './content-model.mjs';
// Authored recipes; upstream research provenance is in docs/research/prompts-whiteboard-2026-10-16.md.
export const contentRecipes=Object.freeze(([
  {
    "id": "mystery-payoff",
    "name": "Bí ẩn có lời giải",
    "audience": "Người thích truyện bí ẩn đời thường, xem trên điện thoại",
    "goal": "Kể một truyện hoàn chỉnh: nhân vật có mục tiêu, gặp dấu hiệu lạ, thử hành động, chịu hệ quả rồi lựa chọn. Gieo manh mối sớm; kết giải được câu hỏi đầu. Chỉ một quy luật lạ. Mỗi cảnh phải đổi tình thế; không kết bằng lời khuyên chung.",
    "structure": "story",
    "targetSeconds": 110
  },
  {
    "id": "everyday-choice",
    "name": "Một lựa chọn đổi câu chuyện",
    "audience": "Người thích những câu chuyện đời thường có cảm xúc",
    "goal": "Mở bằng tình huống cụ thể và điều nhân vật có thể mất. Cho thấy hai lựa chọn, một quyết định và hậu quả dễ hiểu. Kết bằng hành động hoặc chi tiết gợi lại mở đầu. Tránh đạo lý dài, nhân vật chỉ giải thích và cú lật không có manh mối.",
    "structure": "story",
    "targetSeconds": 100
  },
  {
    "id": "one-mechanism",
    "name": "Giải thích bằng một sơ đồ",
    "audience": "Người chưa biết chủ đề và muốn hiểu qua ví dụ dễ hình dung",
    "goal": "Đặt một câu hỏi rõ, giải thích một cơ chế bằng 3–5 bước và một ví dụ cụ thể. Mỗi cảnh chỉ nhấn một ý. Đề xuất sơ đồ có ít chữ; kết bằng điều người xem có thể tự kiểm tra. Dữ kiện thiếu nguồn phải đánh dấu cần bổ sung.",
    "structure": "explain",
    "targetSeconds": 75
  },
  {
    "id": "misconception-evidence",
    "name": "Hiểu nhầm và bằng chứng",
    "audience": "Người muốn kiểm tra một nhận định thường gặp",
    "goal": "Nêu nhận định cần kiểm tra, chỉ rõ trường hợp đúng/sai, dùng nguồn được cung cấp và ví dụ có thể đối chiếu. Phân biệt quan sát với suy luận. Không bịa con số, trích dẫn hay nghiên cứu. Kết bằng câu trả lời có điều kiện rõ ràng.",
    "structure": "comparison",
    "targetSeconds": 90
  },
  {
    "id": "demo-before-after",
    "name": "Demo trước và sau",
    "audience": "Người đang gặp vấn đề được nêu trong chủ đề",
    "goal": "Cho xem vấn đề ban đầu, thao tác cụ thể và kết quả cùng tiêu chí so sánh. Chỉ nói tính năng đã kiểm tra hoặc dữ kiện người dùng cung cấp; thiếu bằng chứng thì đánh dấu cần bổ sung. Nêu giới hạn ngắn, không quảng cáo vượt kết quả thật.",
    "structure": "product",
    "targetSeconds": 75
  },
  {
    "id": "situational-comparison",
    "name": "Chọn theo tình huống",
    "audience": "Người cần chọn giữa các phương án trong chủ đề",
    "goal": "Đặt một tình huống thật cụ thể, so sánh tối đa ba phương án theo cùng 2–3 tiêu chí. Nêu đánh đổi và chọn phương án cho tình huống đó. Không tuyên bố tốt nhất cho mọi người; đánh dấu dữ kiện chưa có thay vì tự điền giá hoặc số liệu.",
    "structure": "comparison",
    "targetSeconds": 90
  }
]).map(Object.freeze));
const fields=['audience','goal','structure','targetSeconds'];
for(const recipe of contentRecipes)validateContentBrief({subject:'Mẫu',sourceNotes:'',...Object.fromEntries(fields.map(field=>[field,recipe[field]]))});
export function previewRecipe(brief,id){
 const recipe=contentRecipes.find(r=>r.id===id);if(!recipe)throw Error('RECIPE_NOT_FOUND');
 return {id,name:recipe.name,changes:fields.filter(field=>brief[field]!==recipe[field]).map(field=>({field,before:brief[field],after:recipe[field]}))};
}
export function applyRecipe(brief,id){
 const preview=previewRecipe(brief,id),before={},after={},next={...brief};
 for(const field of fields){before[field]=brief[field];after[field]=contentRecipes.find(r=>r.id===id)[field];next[field]=after[field];}
 return {brief:next,undo:{before,after},changes:preview.changes};
}
export function undoRecipe(brief,snapshot){
 if(!snapshot||fields.some(field=>brief[field]!==snapshot.after[field]))throw Error('RECIPE_UNDO_STALE');
 const next={...brief};for(const field of fields)next[field]=snapshot.before[field];
 return next;
}
