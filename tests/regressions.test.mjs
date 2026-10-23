import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SEED} from '../src/seed.js';
import {areTimetablesContentEqual,arePublishedContentEqual} from '../src/core.js';
test('school week and custom fields are persisted as business changes',()=>{
 const a=structuredClone(SEED),b=structuredClone(SEED);b.school.weekDates='26/10 - 30/10/2026';assert.equal(areTimetablesContentEqual(a,b),false);
 const c=structuredClone(a);c.classes[0].weekInfo={week:'11',dates:'26/10'};assert.equal(areTimetablesContentEqual(a,c),false);
 const d=structuredClone(a);d.school.note='Changed';assert.equal(areTimetablesContentEqual(a,d),false);
});
test('metadata is ignored only at document root',()=>{
 const a=structuredClone(SEED),b=structuredClone(SEED);b.updatedAt='later';b.revision=100;assert.equal(areTimetablesContentEqual(a,b),true);
 b.school.updatedAt='meaningful nested field';assert.equal(areTimetablesContentEqual(a,b),false);
});
test('publication ignores draft workflow metadata but includes school and class fields',()=>{
 const a=structuredClone(SEED),b=structuredClone(SEED);b.versions=[{name:'new'}];b.activeVersion='published';assert.equal(arePublishedContentEqual(a,b),true);
 b.school.weekDates='new dates';assert.equal(arePublishedContentEqual(a,b),false);
});

