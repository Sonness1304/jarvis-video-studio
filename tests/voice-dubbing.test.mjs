import test from 'node:test';import assert from 'node:assert/strict';import {parseSrt,validateDubbing,slotPlan,toDubbingSrt,updateSegment,dubbingCapture,dubbingCurrent} from '../web/dubbing-model.mjs';
const doc={schemaVersion:1,id:'dub-11111111-1111-4111-8111-111111111111',sourceAssetId:'asset-test',sourceHash:'a'.repeat(64),duration:10,segments:[{id:'segment-1',start:0,end:3,sourceText:'Xin chào',targetText:'Chào bạn'}]};
test('SRT imports Unicode at absolute times without narration gaps and rejects overlaps/range/101segments',()=>{
 assert.equal(parseSrt('1\n00:00:00,000 --> 00:00:03,000\nXin chào\n',10)[0].start,0);assert.throws(()=>parseSrt('1\n00:00:00,000 --> 00:00:11,000\nXin chào',10),/DUB/);
 assert.throws(()=>validateDubbing({...doc,segments:Array.from({length:101},(_,i)=>({...doc.segments[0],id:'segment-'+i}))}),/DUB/);
 assert.throws(()=>validateDubbing({...doc,segments:[doc.segments[0],{...doc.segments[0],id:'segment-2',start:2,end:4}]}),/DUB/);assert.match(toDubbingSrt(doc),/00:00:00,000 --> 00:00:03,000/);
});
test('async result cannot overwrite a local SRT import/undo while document revision stays the same',()=>{
 const record={revision:1,doc:structuredClone(doc)},capture=dubbingCapture(record);assert.equal(dubbingCurrent(capture,record),true);record.doc.segments[0].sourceText='Imported meanwhile';assert.equal(dubbingCurrent(capture,record),false);
});
test('slot padding and bounded atempo preserve slots, overflow never truncates words',()=>{
 assert.deepEqual(slotPlan({start:0,end:3},2),{start:0,slot:3,speed:1,pad:1});assert.ok(slotPlan({start:0,end:3},3.2).speed<=1.1);assert.throws(()=>slotPlan({start:0,end:3},4),/DUB_OVERFLOW/);
});
test('editing source invalidates translation and take; editing target invalidates only take',()=>{
 const v={...doc,segments:[{...doc.segments[0],selection:{jobId:'job-test',signature:'test'}}]};const next=updateSegment(v,'segment-1',{sourceText:'Nguồn mới'});assert.equal(next.segments[0].targetText,'');assert.equal(next.segments[0].selection,undefined);const target=updateSegment(v,'segment-1',{targetText:'Đọc mới'});assert.equal(target.segments[0].sourceText,'Xin chào');assert.equal(target.segments[0].selection,undefined);
});
