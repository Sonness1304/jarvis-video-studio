import test from 'node:test';import assert from 'node:assert/strict';
import {validateInstalledRuntime,validateModelRef} from '../src/runtime.mjs';
test('preflight uses installed Python dependency versions instead of declared versions alone',()=>{
 const lock='vieneu==3.8.3\nonnxruntime==1.31.0\nsea-g2p==0.10.0\n';const a={python:'3.12.14',dependencies:{vieneu:'3.8.3',onnxruntime:'1.31.0','sea-g2p':'0.10.0'}};
 assert.equal(validateInstalledRuntime(lock,'3.12.14',a),true);
 for(const bad of [{...a,python:'3.12.15'},{...a,dependencies:{...a.dependencies,vieneu:'3.9.0'}},{...a,dependencies:{...a.dependencies,'sea-g2p':'0.9.0'}},{...a,dependencies:{}}])assert.throws(()=>validateInstalledRuntime(lock,'3.12.14',bad));
});
test('offline loader refs must resolve the snapshot whose hashes were verified',()=>{
 assert.equal(validateModelRef('a'.repeat(40),'a'.repeat(40)),true);assert.throws(()=>validateModelRef('b'.repeat(40),'a'.repeat(40)));assert.throws(()=>validateModelRef('../foreign','a'.repeat(40)));
});
