import type {TestEvidence} from './team-workflow.ts';
export type EvidenceState='not_run'|'incomplete'|'stale'|'blocked'|'failed'|'passed';
/** Independent of model verdicts. Expected commands are supplied by the trusted profile. */
export function evidenceState(evidence:TestEvidence[],options:{commands?:string[];revision?:string;source?:'runner'|'mock'}={}):EvidenceState {
 if(!evidence.length)return 'not_run';
 if(options.revision&&evidence.some(e=>e.revision!==options.revision))return 'stale';
 if(options.source&&evidence.some(e=>e.source!==options.source))return 'incomplete';
 if(new Set(evidence.map(e=>e.command)).size!==evidence.length)return 'incomplete';
 if(options.commands&&(evidence.length!==options.commands.length||options.commands.some(c=>!evidence.some(e=>e.command===c))))return 'incomplete';
 if(evidence.some(e=>e.status==='FAIL'))return 'failed';
 if(evidence.some(e=>e.status!=='PASS'||e.exitCode!==0))return 'blocked';
 return 'passed';
}
export function checkKind(command:string):'unit'|'build'|'browser'|'other'{
 if(/^(?:vitest run|node --experimental-strip-types --test)\b/.test(command))return 'unit';
 if(/^tsc --noEmit\b/.test(command)&&/vite build/.test(command))return 'build';
 if(/(?:chromium|playwright|browser)/i.test(command))return 'browser';return 'other';
}
export function webEvidenceComplete(evidence:TestEvidence[]){return ['unit','build','browser'].every(k=>evidence.some(e=>checkKind(e.command)===k));}
