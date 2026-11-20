import {test} from 'node:test';import assert from 'node:assert/strict';import {RealExecutionPort} from '../server/orchestration.mjs';
const fail=report=>({source:'runner',status:'FAIL',command:'Playwright Chromium (sandboxed): acceptance',...(report?{report}:{}),revision:'a'.repeat(64)}),full={complete:true};
test('a correction uses full diagnostics from its named current QA gate while retaining legacy ancestor failures',()=>{
 const port=new RealExecutionPort({maxActive:2}),t={teamSpec:{kind:'implementation',remediationFor:['qa-new','security-new']}},old={taskId:'qa-old',tests:[fail()]},fresh={taskId:'qa-new',tests:[fail(full)]},context={inputs:{handoffs:[old,fresh]}};const preserved=structuredClone(context);assert.doesNotThrow(()=>port.requireFailureReport(t,context));assert.deepEqual(context,preserved);
 for(const handoffs of [[old],[{taskId:'qa-new',tests:[fail()]}],[fresh,{taskId:'security-new',tests:[fail()]}],[{taskId:'qa-other',tests:[fail(full)]},old]])assert.throws(()=>port.requireFailureReport(t,{inputs:{handoffs}}),/Complete browser failure report/);
 const continuation={teamSpec:{kind:'implementation',remediationFor:['blocked-implementation']}};assert.throws(()=>port.requireFailureReport(continuation,context),/Complete browser/);assert.doesNotThrow(()=>port.requireFailureReport(continuation,{inputs:{handoffs:[fresh]}}));
});
