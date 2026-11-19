import type {Workflow,WorkflowTask} from './model.ts';
export type DependencyRequirement='specification'|'applied_code'|'verification'|'independent_approval'|'analysis';
/** System-owned semantics; an implementation can never depend on a future system QA gate in a Lead plan. */
export function dependencyRequirement(w:Workflow,id:string):DependencyRequirement {
 const source=w.tasks.find(t=>t.id===id);if(!source)throw Error('Missing dependency');
 const kind=source.id==='plan'?'analysis':source.teamSpec?.kind;
 return kind==='specification'?'specification':kind==='implementation'?'applied_code':kind==='qa'?'verification':kind==='review'?'independent_approval':'analysis';
}
