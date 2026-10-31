// Prepare authored pilot briefs/metadata and proof inputs; never launches rendering or publishing.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {canonicalBrief,ProjectStore} from '../src/editor-store.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
const QR=require(path.join(root,'.tools/motion-lab/node_modules/qrcode')),decoder=require(path.join(root,'.tools/motion-lab/node_modules/jsqr'));
for(const [name,version] of [['qrcode','1.5.4'],['jsqr','1.4.0']])if(require(path.join(root,'.tools/motion-lab/node_modules',name,'package.json')).version!==version)throw Error('QR_TOOL_VERSION_CHANGED');
const qr=QR.create('JARVIS MOTION LAB',{version:3,errorCorrectionLevel:'H'}),n=qr.modules.size;
const matrix=Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=>qr.modules.get(y,x)?'1':'0').join(''));
const scenes=(kind,rows)=>rows.map(([stage,title,lines],i)=>({id:'scene-'+i,title,visual:'motion-lab',lab:{kind,stage,...(kind==='qr'?{matrix}:{})},phrases:lines.map((text,j)=>({id:'s'+i+'-p'+j,text}))}));
const pilots=[
 {slug:'qr',title:'QR bị che, sao vẫn đọc?',kind:'qr',accent:'#176EAA',cover:'QR bị che vẫn đọc được?',sources:[{id:'denso',url:'https://www.qrcode.com/en/about/error_correction.html',claim:'QR có thể phục hồi dữ liệu hỏng bằng sửa lỗi; mức phục hồi tính theo codewords, không phải mọi vùng diện tích ảnh.',assessment:'Đối chiếu DENSO; thí nghiệm riêng decode ba trạng thái; không suy bảo đảm30%diện tích.'}],rows:[
  ['clean','QR bị che, sao vẫn đọc?', ['Một mã quy a bị che một phần. Vì sao điện thoại vẫn có thể đọc?', 'Bí mật nằm ở dữ liệu sửa lỗi được thêm khi tạo mã.']],
  ['small','Che một phần ở giữa', ['Thử che chín ô ở giữa mã này. Nội dung vẫn có thể được khôi phục.', 'Bộ đọc dùng dữ liệu dư để sửa những phần bị mất.']],
  ['guides','Không chỉ có ô đen trắng', ['Ba ô vuông lớn giúp bộ đọc tìm vị trí và hướng của mã.', 'Dữ liệu sửa lỗi có ích, nhưng không cứu được mọi kiểu hỏng.']],
  ['large','Hỏng quá nhiều thì sao?', ['Giờ che mạnh cả vùng định vị. Bộ đọc có thể không còn nhận ra mã.', 'Mức sửa lỗi cao không có nghĩa che chỗ nào cũng được.']],
  ['small','Có dự phòng, vẫn có giới hạn', ['Vậy mã bị che vẫn đọc được là nhờ khả năng phục hồi có giới hạn.', 'Đây là thử nghiệm trên mã thật, không phải lời hứa cho mọi mã.']]
 ]},
 {slug:'water',title:'Ống hút không gãy trong nước',kind:'refraction',accent:'#1787AC',cover:'Ống hút gãy hay mắt bị lừa?',sources:[{id:'openstax',url:'https://openstax.org/books/university-physics-volume-3/pages/2-3-images-formed-by-refraction',claim:'Tia sáng khúc xạ ở mặt phân cách; kéo dài tia ló cho ảnh biểu kiến ở độ sâu khác. Từ nước ra khí tia lệch xa pháp tuyến ở góc dưới tới hạn.',assessment:'Sơ đồ2D với n nước1.333/khí1, góc theo Snell; bỏ qua thành cốc và phối cảnh.'}],rows:[
  ['straw','Ống hút có thật sự gãy?', ['Một chiếc ống hút thẳng, nhúng vào nước lại trông như bị gãy.', 'Ống không đổi hình dạng. Thứ thay đổi là đường đi của ánh sáng.']],
  ['rays','Ánh sáng đổi hướng', ['Ánh sáng từ phần ống dưới nước đi qua mặt nước rồi tới mắt.', 'Khi ra không khí, tia sáng đổi hướng, lệch xa đường pháp tuyến.']],
  ['apparent','Mắt kéo dài đường thẳng', ['Mắt định vị vật theo đường tia sáng tới, như thể tia đi thẳng.', 'Vì vậy phần chìm hiện ra ở vị trí biểu kiến nông hơn.']],
  ['apparent','Gãy trong ảnh, không gãy thật', ['Hai phần trông lệch nhau ở mặt nước, tạo cảm giác ống bị gãy.', 'Hình này là mô hình đơn giản, bỏ qua thành cốc và góc nhìn.']]
 ]},
 {slug:'zip',title:'Nén ZIP không làm mất dữ liệu?',kind:'compression',accent:'#8057B5',cover:'File nhỏ đi, dữ liệu đâu rồi?',sources:[{id:'rfc1951',url:'https://www.rfc-editor.org/rfc/rfc1951',claim:'DEFLATE là nén lossless kết hợp LZ77 và Huffman, gồm literal và tham chiếu ngược. Không có thuật toán lossless làm nhỏ mọi dữ liệu.',assessment:'Ví dụ ABC+backreference là nguyên lý; receipt kèm mẫu DEFLATE thật và hash giải nén, không giả byte sơ đồ là fileZIP.'}],rows:[
  ['repeat','File nhỏ đi, chữ đâu rồi?', ['Một tệp nén nhỏ hơn, nhưng giải nén lại vẫn đủ từng chữ. Vì sao?', 'Hãy nhìn chuỗi A B C lặp lại nhiều lần trong ví dụ này.']],
  ['reference','Đừng viết lại, hãy tham chiếu', ['Thay vì ghi lại đoạn giống nhau, bộ nén có thể trỏ về đoạn đã có.', 'Chẳng hạn: quay lại ba ký tự, rồi chép tiếp chín ký tự.']],
  ['restore','Giải nén khôi phục đúng', ['Bộ giải nén làm theo tham chiếu để khôi phục nguyên dữ liệu ban đầu.', 'Đó là nguyên lý nén không mất dữ liệu, khác với bỏ bớt chi tiết ảnh.']],
  ['limits','Không phải tệp nào cũng nhỏ', ['Nhưng ảnh và video đã nén có thể chẳng nhỏ thêm, thậm chí lớn hơn.', 'Đây là sơ đồ nguyên lý. Mẫu thử kèm theo kiểm tra giải nén đúng từng byte.']]
 ]}
];
const sha=v=>createHash('sha256').update(v).digest('hex');
await fs.mkdir(path.join(root,'briefs/creator-packs'),{recursive:true});await fs.mkdir(path.join(root,'.runtime/motion-lab'),{recursive:true});
const result=[];
for(const p of pilots){const id='motion-lab-'+p.slug,brief=canonicalBrief({schemaVersion:1,id,title:p.title,preset:'explain',template:'explain-short',theme:'editorial',voice:'Hải Đăng',format:'portrait',accent:p.accent,branding:{label:'Ủa, Sao Vậy?',subline:'Motion Lab',footer:'Minh họa tự dựng · nguồn trong Creator Pack'},captions:{enabled:true,style:'editorial',fontSize:25,position:'bottom'},scenes:scenes(p.kind,p.rows)});
 const record=await new ProjectStore(root).create(brief);
 const metadata={schemaVersion:1,contentId:id,projectId:id,revision:record.revision,sources:p.sources,rights:[{asset:'Lời kể, sơ đồ, animation và cover',basis:'Coordinator tự viết cho user; không stock/video tái đăng.'},{asset:'Giọng và font',basis:'VieNeu preset local theo model-provenance; BeVietnamPro OFL. Không clone giọng cá nhân.'}],cover:{sceneId:'scene-1',title:p.cover},copy:Object.fromEntries(['youtube','facebook','tiktok'].map(platform=>[platform,{title:p.title,caption:p.title+'\n'+({qr:'QR có dữ liệu sửa lỗi, nhưng không cứu được mọi kiểu hỏng.',water:'Ống vẫn thẳng. Ánh sáng đổi hướng khi qua mặt nước.',zip:'Nén lossless dùng cách biểu diễn gọn hơn, không tự làm nhỏ được mọi tệp.'}[p.slug])+'\nMinh họa do Jarvis dựng; giọng AI tiếng Việt. #UaSaoVay #KienThuc #MotionLab'}]))};
 for(const [file,value] of [[`briefs/${id}.json`,brief],[`briefs/creator-packs/${id}.json`,metadata]])await fs.writeFile(path.join(root,file),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 result.push({id,revision:record.revision,brief:`briefs/${id}.json`,metadata:`briefs/creator-packs/${id}.json`});
}
const sample=Buffer.from('ABCABCABCABC\n'.repeat(120)),compressed=deflateRawSync(sample),restored=inflateRawSync(compressed);
if(!sample.equals(restored))throw Error('LOSSLESS_FAILED');
const proof={schemaVersion:1,status:'VERIFIED',algorithm:'DEFLATE raw (not ZIP container)',inputBytes:sample.length,compressedBytes:compressed.length,inputSha256:sha(sample),restoredSha256:sha(restored),equal:true,illustration:'ABC + backward distance3,length9; overlapping copy',qr:{payload:'JARVIS MOTION LAB',version:qr.version,ecc:'H',maskPattern:qr.maskPattern,matrixSha256:sha(matrix.join('\n')),generator:'qrcode1.5.4 MIT',decoder:'jsqr1.4.0 Apache2.0',nativeFrameDecode:'UNVERIFIED'}};
await fs.writeFile(path.join(root,'.runtime/motion-lab/inputs-proof.json'),JSON.stringify(proof,null,2)+'\n');await fs.writeFile(path.join(root,'.runtime/motion-lab/pilots.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:'VERIFIED',pilots:result,deflate:proof.compressedBytes,qrVersion:qr.version}));
