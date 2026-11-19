/** Contract D2. JavaScript string lengths, not tokens or UTF-8 byte counts. */
export const workflowBudgets=Object.freeze({
 version:1,maxTasks:12,maxUniqueFiles:8,maxFilesPerImplementationTask:4,
 maxCharactersPerPatchFile:12000,maxCharactersPerProposal:24000,
 maxPromptCharacters:10000,maxInputFiles:16,maxInputHandoffs:40,maxInputCharacters:100000,
 maxResponseCharacters:128000,maxContinuationAttempts:2,
});
export function proposalBudget(patches:{path:string;content:string}[]){
 const b=workflowBudgets,total=patches.reduce((n,p)=>n+p.content.length,0);
 if(patches.length>b.maxFilesPerImplementationTask||new Set(patches.map(p=>p.path)).size!==patches.length)throw new Error('Patch limit: file count or duplicate paths');
 if(patches.some(p=>p.content.length>b.maxCharactersPerPatchFile))throw new Error('Patch limit: file content exceeds '+b.maxCharactersPerPatchFile);
 if(total>b.maxCharactersPerProposal)throw new Error('Patch limit: total '+total+' > '+b.maxCharactersPerProposal+' characters');
 return {files:patches.length,characters:total};
}
