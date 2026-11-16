// Stable turn/start.outputSchema is present in installed codex-cli 0.144.5's generated schema.
const str=(maxLength=500)=>({type:'string',maxLength});
const arr=(items,maxItems=10)=>({type:'array',items,maxItems});
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function teamOutputSchema(task){
 if(!task.teamSpec)return undefined;
 if(task.id==='plan')return obj({tasks:arr(obj({id:str(48),title:str(160),description:str(1600),type:{type:'string',enum:['design','frontend','backend']},dependencies:arr(str(48),12),requiredSkills:arr(str(100),4),priority:{type:'string',enum:['low','normal','high']},permissions:{type:'array',items:{type:'string',enum:['read-only']},minItems:1,maxItems:1},acceptance:arr(str(500),5),scope:arr(str(180),8)}),12)});
 const kind=task.teamSpec.kind,verdict=kind==='review'?['APPROVED','CHANGES_REQUIRED','BLOCKED']:['PASS','FAIL','BLOCKED'];
 return obj({summary:str(4000),filesChanged:arr(str(),0),decisions:arr(str()),warnings:arr(str()),unresolved:arr(str()),team:obj({verdict:{type:'string',enum:verdict},completedWork:arr(str()),codeInfo:arr(str()),tests:arr(str(),0),findings:arr(obj({id:str(100),severity:{type:'string',enum:['critical','high','medium','low']},message:str(1000),responsibleTask:str(48),reproduction:str(1000),files:arr(str(180),8)})),patches:arr(obj({path:{type:'string',enum:task.teamSpec.scope.length?task.teamSpec.scope:['src/unavailable.ts']},before:{type:['string','null']},content:str(12000)}),kind==='implementation'?4:0),nextAction:str(1000)})});
}
