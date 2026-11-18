/** End-to-end QA protocol check against a synthetic fixture, not the user's unimplemented site. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {WebQAExecutor} from '../server/qa-web.mjs';
import {armgarageFixture} from '../tests/fixtures/armgarage-contract.mjs';
import {armgarageDomain} from '../tests/fixtures/armgarage-domain.mjs';
import packages from '../server/qa-web-image/package.json' with {type:'json'};
const manifest={...packages,name:'armgarage',devDependencies:{...packages.devDependencies}};delete manifest.devDependencies.playwright;
const contents={
 'package.json':JSON.stringify(manifest),'package-lock.json':'{}',
 'index.html':armgarageFixture()[0].text.replace('<script>','<script type="module">'),
 'src/main.tsx':'export {};','test-support/setup.ts':"import '@testing-library/jest-dom/vitest';",
 'tsconfig.json':'{"compilerOptions":{"jsx":"react-jsx"}}','vite.config.ts':'export default {};',
 'src/domain/garage.ts':armgarageDomain(),'src/App.tsx':'export default function App(){return <main>Fixture only</main>}',
 'tests/garage.test.ts':"import {it,expect} from 'vitest';import {calculateEstimate} from '../src/domain/garage';it('project fixture',()=>expect(calculateEstimate([]).total).toBe(0));",
};
const sources=Object.entries(contents).map(([path,text])=>({path,text})),revision=createHash('sha256').update(JSON.stringify(sources)).digest('hex'),executor=new WebQAExecutor({registration:'armgarage'}),status=await executor.verify();assert(status.available,status.reason);const records=await executor.run({profile:'armgarage_checks',files:['tests/garage.test.ts'],sources,revision});for(const r of records){console.log(r.status+' '+r.command);if(r.status!=='PASS')console.log(r.output);}assert.equal(records.length,3);assert(records.every(r=>r.status==='PASS'&&r.revision===revision&&r.source==='runner'),'Fixture QA pipeline failed');assert(records[0].output.includes('armgarage-domain.test.mjs'));
const file='docs/ARMGARAGE_QA_EVIDENCE.json',evidence=JSON.parse(readFileSync(file));assert.equal(evidence.image,status.image,'Evidence image mismatch');evidence.pipelineFixture={scope:'synthetic fixture only',profile:status.profile,image:status.image,revision,records};writeFileSync(file,JSON.stringify(evidence,null,2)+'\n');console.log('PASS synthetic fixture: attributed Vitest, trusted domain, production build and three-viewport browser receipts');
