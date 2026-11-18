/** Validate the new acceptance harness against synthetic fixtures, never a user project or Codex. */
import {writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {WebQAExecutor,webSupportFiles} from '../server/qa-web.mjs';
import {armgarageFixture} from '../tests/fixtures/armgarage-contract.mjs';
import {armgarageDomain} from '../tests/fixtures/armgarage-domain.mjs';
import packages from '../server/qa-web-image/package.json' with {type:'json'};
const executor=new WebQAExecutor({registration:'armgarage'}),status=await executor.verify();if(!status.available)throw Error(status.reason);
const cases=[['none',null],['broken-filter',/service-card|toHaveCount/],['wrong-calculator',/calc-total/],['past-date-allowed',/booking-error-date/],['leak-storage',/Personal data persisted/],['outgoing-submit',/Forbidden request: POST/],['fake-confirmation',/booking-success/]],results=[];
for(const [mutation,expectedFailure] of cases){const result=await executor.execute('browser',{assets:armgarageFixture(mutation)});if(result.timedOut||result.limited||result.code===null)throw Error('Inconclusive fixture run: '+mutation);if(!expectedFailure){assert.equal(result.code,0,result.output);assert(result.output.includes('"width":390')&&result.output.includes('"width":768')&&result.output.includes('"width":1440'));}else{assert.notEqual(result.code,0,'Broken fixture incorrectly passed: '+mutation);assert.match(result.output,expectedFailure,'Failure was unrelated to the injected defect: '+mutation);}results.push({fixture:mutation,expected:expectedFailure?'reject':'pass',observed:result.code===0?'pass':'reject',exitCode:result.code});console.log('PASS acceptance harness '+mutation+' -> '+results.at(-1).observed);}
const packageFixture={...packages,name:'armgarage',devDependencies:{...packages.devDependencies}};delete packageFixture.devDependencies.playwright;
const configFiles={
 'package.json':JSON.stringify(packageFixture),'package-lock.json':'{}','index.html':'<div id="root"></div>',
 'src/main.tsx':'export {};','test-support/setup.ts':"import '@testing-library/jest-dom/vitest';",
 'tsconfig.json':'{"compilerOptions":{"jsx":"react-jsx"}}','vite.config.ts':'export default {};',
};
const domainCases=[];
for(const [mutation,pattern] of [['none',null],['floor-rounding',/rounds the final fractional/],['wrong-sort',/sorts prices numerically/],['accept-letters',/normalizes valid Armenian phones/],['past-date-allowed',/rejects past\/non-calendar dates/]]){
 const sources=[...webSupportFiles.map(path=>({path,text:configFiles[path]})),{path:'src/domain/garage.ts',text:armgarageDomain(mutation)},{path:'tests/garage.test.ts',text:"import {it,expect} from 'vitest'; import {calculateEstimate} from '../src/domain/garage'; it('project test fixture',()=>expect(calculateEstimate([]).total).toBe(0));"}];
 const r=await executor.execute('vitest',{files:['tests/garage.test.ts'],sources});assert(!r.timedOut&&!r.limited&&r.code!==null,'Inconclusive domain fixture');assert(r.output.includes('armgarage-domain.test.mjs'),'Trusted tests were not executed');if(!pattern)assert.equal(r.code,0,r.output);else{assert.notEqual(r.code,0,'Domain defect incorrectly passed');assert.match(r.output,pattern);}
 domainCases.push({fixture:mutation,expected:pattern?'reject':'pass',observed:r.code===0?'pass':'reject',exitCode:r.code});console.log('PASS trusted domain '+mutation+' -> '+domainCases.at(-1).observed);
}
writeFileSync('docs/ARMGARAGE_QA_EVIDENCE.json',JSON.stringify({scope:'QA harness validation only; ARMGARAGE application is not implemented or verified',profile:status.profile,image:status.image,isolation:status.available,viewports:[390,768,1440],cases:results,trustedDomainTests:17,domainCases,realCodexJobs:0,coffeeHouseProjectRuns:0},null,2)+'\n');
