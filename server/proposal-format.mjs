import {workflowBudgets} from '../src/orchestration/budgets.ts';
import {createHash} from 'node:crypto';
import {collectTeamResult} from '../src/orchestration/team-workflow.ts';
/** Remove indentation only from whitespace trivia between parsed TS/JSX tokens. */
export async function reduceIndentation(path,text){
 const {default:ts}=await import('typescript');
 const parse=value=>{const source=ts.createSourceFile(path,value,ts.ScriptTarget.Latest,true,/\.tsx$/.test(path)?ts.ScriptKind.TSX:ts.ScriptKind.TS);if(source.parseDiagnostics.length)throw new Error('Formatting recovery requires syntactically valid TypeScript');const leaves=[];const visit=n=>{const children=n.getChildren(source);if(children.length)children.forEach(visit);else if(n.end>n.pos)leaves.push({start:n.kind===ts.SyntaxKind.JsxText?n.pos:n.getStart(source),end:n.end,kind:n.kind});};visit(source);return {source,leaves};};
 const before=parse(text),edits=[];for(let i=1;i<before.leaves.length;i++){const start=before.leaves[i-1].end,end=before.leaves[i].start,gap=text.slice(start,end);if(/^\s*$/.test(gap)){const replacement=gap.replace(/\n[ \t]+/g,'\n');if(replacement!==gap)edits.push({start,end,replacement});}}
 let result=text;for(const e of edits.reverse())result=result.slice(0,e.start)+e.replacement+result.slice(e.end);const after=parse(result),tokens=(parsed,value)=>parsed.leaves.map(t=>[t.kind,value.slice(t.start,t.end)]);
 if(JSON.stringify(tokens(before,text))!==JSON.stringify(tokens(after,result))||text.replace(/[ \t]/g,'')!==result.replace(/[ \t]/g,''))throw new Error('Formatting recovery changed tokens, comments, literals or line breaks');return result;
}
export async function repairProposalFormatting(t,originalResponse){
 const original=JSON.parse(originalResponse),patches=original.team?.patches;if(!Array.isArray(patches)||!patches.length||new Set(patches.map(p=>p.path)).size!==patches.length||patches.some(p=>typeof p.content!=='string'||p.content.length>workflowBudgets.maxCharactersPerPatchFile))throw new Error('Only an aggregate patch budget can be repaired by formatting');const total=patches.reduce((n,p)=>n+p.content.length,0);if(total<=workflowBudgets.maxCharactersPerProposal)throw new Error('No aggregate patch overflow');
 for(const p of patches.filter(p=>/\.(?:ts|tsx)$/.test(p.path))){const content=await reduceIndentation(p.path,p.content);if(content.length===p.content.length)continue;const corrected=structuredClone(original);corrected.team.patches.find(q=>q.path===p.path).content=content;const text=JSON.stringify(corrected);try{collectTeamResult(text,t);}catch{continue;}return {executionId:t.executionId,originalResponse,originalSha256:createHash('sha256').update(originalResponse).digest('hex'),correctedResponse:text,changedPath:p.path,removedCharacters:p.content.length-content.length,createdAt:new Date().toISOString()};}
 throw new Error('Formatting alone cannot satisfy patch limits; preserve the response and split the task explicitly');
}
