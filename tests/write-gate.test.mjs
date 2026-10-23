import test from 'node:test';
import assert from 'node:assert/strict';
import {WriteGate,contentSignature,mergeFields} from '../src/write-gate.js';
test('unchanged document with new timestamps costs zero writes',async()=>{
  const gate=new WriteGate();let count=0;
  gate.observe('working',{school:{name:'A'},versions:[],updatedAt:'old',revision:2});
  const result=await gate.run('working',{versions:[],school:{name:'A'},updatedAt:'new',updatedBy:'admin',revision:3},async()=>count++);
  assert.equal(result.skipped,true);assert.equal(count,0);
});
test('actual cell changes write once and next identical save is skipped',async()=>{
  const gate=new WriteGate();let count=0;
  gate.observe('working',{cells:[]});
  const next={cells:[{subjectId:'math'}]};
  await gate.run('working',next,async()=>count++);await gate.run('working',next,async()=>count++);
  assert.equal(count,1);
});
test('rapid concurrent calls do not submit another mutation',async()=>{
  const gate=new WriteGate();let count=0,finish;
  const pending=gate.run('requests/a',{reason:'A'},()=>{count++;return new Promise(resolve=>finish=resolve);});
  await assert.rejects(gate.run('requests/b',{reason:'A'},async()=>count++),e=>e.code==='write-in-progress');
  finish();await pending;assert.equal(count,1);
});
test('quota rejection stops further app writes, including after account change',async()=>{
  const gate=new WriteGate();let count=0;
  await assert.rejects(gate.run('a',{},async()=>{count++;throw {code:'resource-exhausted'};}));
  gate.clear();await assert.rejects(gate.run('b',{},async()=>count++),e=>e.code==='resource-exhausted');
  assert.equal(count,1);
});
test('failed save never becomes a successful baseline and can be retried deliberately',async()=>{
  const gate=new WriteGate();gate.observe('a',{x:1});
  await assert.rejects(gate.run('a',{x:2},async()=>{throw Error('offline');}));
  assert.deepEqual(gate.cache.get('a'),{x:1});
  let count=0;await gate.run('a',{x:2},async()=>count++);assert.equal(count,1);
});
test('dotted profile patch preserves official fields and detects metadata-only updates',()=>{
  const original={role:'TEACHER',selfDeclared:{subjects:['Math'],note:'A'}};
  const next=mergeFields(original,{'selfDeclared.note':'B',updatedAt:'new'});
  assert.equal(next.role,'TEACHER');assert.deepEqual(next.selfDeclared,{subjects:['Math'],note:'B'});
  assert.equal(original.selfDeclared.note,'A');
  assert.equal(contentSignature(original),contentSignature({...original,updatedAt:'later'}));
});
test('logout during an in-flight write does not repopulate old account cache',async()=>{
  const gate=new WriteGate();let finish;
  const pending=gate.run('a',{private:'old user'},()=>new Promise(resolve=>finish=resolve));
  gate.clear();finish();await pending;assert.equal(gate.cache.size,0);
});
test('new remote data arriving during a save is not overwritten in the comparison cache',async()=>{
  const gate=new WriteGate();gate.observe('a',{x:1});let finish;
  const pending=gate.run('a',{x:2},()=>new Promise(resolve=>finish=resolve));
  gate.observe('a',{x:3});finish();await pending;assert.deepEqual(gate.cache.get('a'),{x:3});
});
