const fail=code=>{throw Error(code);};
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,allowed,code)=>{if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail(code);};
const text=(v,max)=>typeof v==='string'&&v.trim()&&v.length<=max&&!/[\x00-\x1f]/.test(v);
export const topicHints={science:'Rõ ràng, điềm tĩnh; thuật ngữ đọc chính xác.',story:'Nhịp kể tự nhiên, có khoảng nghỉ.',horror:'Trầm, chậm vừa phải; nghe thử độ rõ.',product:'Sáng, gọn, rõ tên và con số.'};
export function validateVoice(v){
 keys(v,['provider','voiceId','engine','revision'],'VOICE_IDENTITY');
 if(!['vieneu','voicestudio','profile'].includes(v.provider)||!text(v.voiceId,128))fail('VOICE_IDENTITY');
 if(v.provider==='vieneu'&&(v.voiceId.length>64||v.engine!==undefined||v.revision!==undefined))fail('VOICE_IDENTITY');
 if(v.provider==='voicestudio'&&(!text(v.engine,128)||v.revision!==undefined))fail('VOICE_IDENTITY');
 if(v.provider==='profile'&&(!/^profile-[a-f0-9-]{36}$/.test(v.voiceId)||!Number.isSafeInteger(v.revision)||v.revision<1||v.engine!==undefined))fail('VOICE_IDENTITY');return v;
}
export function validateDictionary(d=[]){
 if(!Array.isArray(d)||d.length>100)fail('VOICE_DICTIONARY');const seen=new Set();
 for(const row of d){keys(row,['from','to'],'VOICE_DICTIONARY');if(!text(row.from,80)||!text(row.to,240)||seen.has(row.from.normalize('NFC')))fail('VOICE_DICTIONARY');seen.add(row.from.normalize('NFC'));}return d;
}
export function pronounce(textValue,dictionary=[],override){
 validateDictionary(dictionary);if(override!==undefined){if(!text(override,240))fail('VOICE_SPEECH');return override.normalize('NFC');}
 const input=textValue.normalize('NFC'),rows=dictionary.map(r=>({from:r.from.normalize('NFC'),to:r.to.normalize('NFC')})).sort((a,b)=>b.from.length-a.from.length);
 const word=c=>!!c&&/[\p{L}\p{N}\p{M}_]/u.test(c);let out='';
 for(let i=0;i<input.length;){const r=rows.find(r=>input.startsWith(r.from,i)&&!word(input.slice(0,i).at(-1))&&!word(input.slice(i+r.from.length).at(0)));if(r){out+=r.to;i+=r.from.length;}else out+=input[i++];}
 if(!out.trim()||out.length>240)fail('VOICE_SPEECH');return out;
}
export function validateVoiceWorkbench(v,scenes){
 keys(v,['schemaVersion','topic','dictionary','defaultVoice','sceneVoices','selections'],'VOICE_WORKBENCH');if(v.schemaVersion!==1||v.topic!==undefined&&!Object.hasOwn(topicHints,v.topic))fail('VOICE_WORKBENCH');validateDictionary(v.dictionary);
 if(v.defaultVoice)validateVoice(v.defaultVoice);const sceneIds=new Set(scenes.map(s=>s.id)),phraseIds=new Set(scenes.flatMap(s=>s.phrases.map(p=>p.id)));
 for(const [field,allowed] of [['sceneVoices',sceneIds],['selections',phraseIds]])if(v[field]!==undefined){if(!object(v[field])||Object.keys(v[field]).length>100)fail('VOICE_WORKBENCH');for(const [id,row] of Object.entries(v[field])){if(!allowed.has(id))fail('VOICE_TARGET');if(field==='sceneVoices')validateVoice(row);else {keys(row,['jobId','signature'],'VOICE_SELECTION');if(!/^job-[a-z0-9-]{1,48}$/.test(row.jobId??'')||!text(row.signature,2048))fail('VOICE_SELECTION');}}}return v;
}
export const phraseVoice=(brief,scene)=>brief.voiceWorkbench?.sceneVoices?.[scene.id]??brief.voiceWorkbench?.defaultVoice??{provider:'vieneu',voiceId:brief.voice};
export const voiceSignature=(brief,scene,phrase)=>JSON.stringify({schemaVersion:1,text:pronounce(phrase.text,brief.voiceWorkbench?.dictionary,phrase.speechText),voice:phraseVoice(brief,scene)});
export function pruneVoiceTargets(brief){const b=structuredClone(brief),w=b.voiceWorkbench;if(!w)return b;const scenes=new Set(b.scenes.map(s=>s.id)),phrases=new Set(b.scenes.flatMap(s=>s.phrases.map(p=>p.id)));for(const [field,ids] of [['sceneVoices',scenes],['selections',phrases]])if(w[field])for(const id of Object.keys(w[field]))if(!ids.has(id))delete w[field][id];return b;}
