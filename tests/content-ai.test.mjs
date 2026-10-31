import test from 'node:test';import assert from 'node:assert/strict';
import {requestContent,contentModels} from '../src/content-ai.mjs';
const input={contentBrief:{subject:'Kịch bản',audience:'',goal:'',targetSeconds:30,structure:'explain',sourceNotes:''},sceneCount:3};
const candidate={schemaVersion:1,title:'Kịch bản',scenes:['hook','explain','conclusion'].map(role=>({role,title:'Ý chính',narration:['Lời kể.'],layout:'kinetic',content:{body:'Ý chính'},reason:'Rõ ý',needsInput:[]}))};
const response=(patch={})=>({model:'claude-sonnet-4-6',usage:{prompt_tokens:20,completion_tokens:30,prompt_tokens_details:{cached_tokens:4}},choices:[{finish_reason:'stop',message:{content:JSON.stringify(candidate)}}],...patch});
function gateway(reply){const calls=[];return {calls,fetchImpl:async(url,options)=>{calls.push({url,options});return url.endsWith('/models')?Response.json({data:[{id:contentModels.sonnet},{id:contentModels.opus}]}):reply instanceof Response?reply:Response.json(reply);}};}
test('fixed Claude endpoint, bounded JSON data, one POST and real provider usage only',async()=>{
 const g=gateway(response()),usage=[];const result=await requestContent({input,model:contentModels.sonnet,apiKey:'SENTINEL_KEY',...g,onUsage:u=>usage.push(u)});
 assert.equal(g.calls.length,2);assert.ok(g.calls.every(c=>c.url.startsWith('http://127.0.0.1:20128/v1/')));assert.ok(g.calls.every(c=>c.options.redirect==='error'));
 const body=JSON.parse(g.calls[1].options.body);assert.deepEqual(body.tools,[]);assert.equal(body.stream,false);assert.equal(body.max_tokens,6000);assert.equal(result.candidate.scenes.length,3);assert.deepEqual(result.usage,{input:20,output:30,cached:4});assert.equal(usage.length,1);
 const missing=gateway(response({usage:undefined}));assert.equal((await requestContent({input,apiKey:'SENTINEL_KEY',...missing})).usage,null);
});
test('refusal, truncation, tool calls, wrong model, oversized and malformed replies never become candidates',async()=>{
 const bad=[{model:'other'},{choices:[{finish_reason:'length',message:{content:'{}'}}]},{choices:[{finish_reason:'stop',message:{content:'{}',tool_calls:[{}]}}]},{choices:[{finish_reason:'stop',message:{refusal:'no',content:'{}'}}]},{choices:[{finish_reason:'stop',message:{content:'SENTINEL_KEY'}}]},{choices:[{finish_reason:'stop',message:{content:'{bad'}}]}];
 for(const patch of bad){const g=gateway(response(patch));await assert.rejects(requestContent({input,apiKey:'SENTINEL_KEY',...g}),e=>!e.message.includes('SENTINEL_KEY'));assert.equal(g.calls.length,2);}
 const huge=gateway(new Response('x'.repeat(1048577)));await assert.rejects(requestContent({input,apiKey:'SENTINEL_KEY',...huge}),/RESPONSE_TOO_LARGE/);
 const rate=gateway(new Response('SENTINEL_KEY raw rate limit',{status:429}));await assert.rejects(requestContent({input,apiKey:'SENTINEL_KEY',...rate}),e=>e.code==='CONTENT_HTTP_429'&&!e.fallbackEligible&&!e.message.includes('SENTINEL'));assert.equal(rate.calls.length,2);
});
test('no POST for absent model or invalid input; failed transport never retries',async()=>{
 let calls=0;await assert.rejects(requestContent({input,apiKey:'x',fetchImpl:async()=>{calls++;return Response.json({data:[]});}}),/MODEL_UNAVAILABLE/);assert.equal(calls,1);
 const g=gateway(response());await assert.rejects(requestContent({input:{...input,command:'run'},apiKey:'x',...g}));assert.equal(g.calls.length,0);
 let n=0;await assert.rejects(requestContent({input,apiKey:'x',fetchImpl:async()=>{if(n++===0)return Response.json({data:[{id:contentModels.sonnet}]});throw Object.assign(Error('secret transport'),{cause:{code:'ECONNREFUSED'}});}}),e=>e.code==='CONTENT_CONNECT_FAILED'&&e.fallbackEligible===true);assert.equal(n,2);
});

test('even model metadata cannot echo a credential into the usage receipt',async()=>{
 const g=gateway(response({model:'SENTINEL_KEY'})),seen=[];await assert.rejects(requestContent({input,apiKey:'SENTINEL_KEY',...g,onUsage:v=>seen.push(v)}));assert.equal(JSON.stringify(seen).includes('SENTINEL_KEY'),false);
});

test('unsupported metrics, attributed quotes and source URLs require human data before Apply',async()=>{
 const c=structuredClone(candidate);c.scenes[0].layout='metric';c.scenes[0].content={metric:'42%',label:'Theo WHO'};c.scenes[0].narration=['Theo WHO, tỷ lệ là 42%. Nguồn https://made-up.invalid/report'];
 c.scenes[1].layout='quote';c.scenes[1].content={body:'Một lời tuyên bố chưa được cung cấp',label:'WHO'};
 const g=gateway(response({choices:[{finish_reason:'stop',message:{content:JSON.stringify(c)}}]}));const out=await requestContent({input,apiKey:'SENTINEL_GROUNDING_KEY',...g});assert.ok(out.candidate.scenes[0].needsInput.length);assert.ok(out.candidate.scenes[1].needsInput.length);
});
