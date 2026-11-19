/** Reference to immutable, sanitized runner diagnostics; never model-authored evidence. */
export interface QAReportRef {version:1;id:string;sha256:string;characters:number;complete:boolean;}
export function validateQAReportRef(r:QAReportRef){
 if(!r||Object.keys(r).sort().join(',')!=='characters,complete,id,sha256,version'||r.version!==1||!/^qa-[a-f0-9]{64}$/.test(r.id)||!/^[a-f0-9]{64}$/.test(r.sha256)||!Number.isInteger(r.characters)||r.characters<0||r.characters>128000||typeof r.complete!=='boolean')throw Error('Invalid QA report reference');
}
