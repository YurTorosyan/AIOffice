import * as nodeFs from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {replaceFile} from './atomic-replace.mjs';
export const contentHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export class DurabilityError extends Error {
 constructor(code,message,{phase='read',outcome='not_committed',cause}={}){super(message,{cause});this.name='DurabilityError';this.code=code;this.phase=phase;this.outcome=outcome;}
}
function regular(fs,file){if(fs.existsSync(file)){const s=fs.lstatSync(file);if(s.isSymbolicLink()||!s.isFile())throw new DurabilityError('UNSAFE_STORE','Store is not a regular file');}}
export function readJson(file,{validate=v=>v,maxBytes=8_000_000,fs=nodeFs}={}){
 regular(fs,file);const bytes=fs.readFileSync(file);if(bytes.length>maxBytes)throw new DurabilityError('STORE_LIMIT','Store exceeds its size budget');
 try{return {value:validate(JSON.parse(bytes.toString('utf8'))),hash:contentHash(bytes)};}catch(cause){throw new DurabilityError('STORE_INVALID','Store data or version is invalid; original preserved',{cause});}
}
/** Caller checks the canonical owned directory. Only the unique temporary file may be removed. */
export function writeJson(file,value,{validate=v=>v,maxBytes=8_000_000,expectedHash,immutable=false,fs=nodeFs,failpoint=()=>{},rename,wait}={}){
 let bytes;try{bytes=Buffer.from(JSON.stringify(validate(value)));}catch(cause){throw new DurabilityError('STORE_INVALID','Refused invalid state before writing',{phase:'validate',cause});}
 if(bytes.length>maxBytes)throw new DurabilityError('STORE_LIMIT','Store exceeds its size budget',{phase:'validate'});
 const target=resolve(file),parent=dirname(target);if(fs.lstatSync(parent).isSymbolicLink()||!fs.lstatSync(parent).isDirectory())throw new DurabilityError('UNSAFE_STORE','Unsafe store parent');regular(fs,target);
 const current=fs.existsSync(target)?contentHash(fs.readFileSync(target)):null;if(expectedHash!==undefined&&current!==expectedHash)throw new DurabilityError('STORE_CONFLICT','Store changed since inspection',{phase:'validate'});
 if(immutable&&current!==null)throw new DurabilityError('ARTIFACT_EXISTS','Immutable artifact already exists',{phase:'validate'});
 const temp=resolve(parent,'.durable-'+randomUUID()+'.tmp'),hash=contentHash(bytes);let phase='prepare',published=false,tempCreated=false;
 try{
  failpoint('before_temp');fs.writeFileSync(temp,bytes,{flag:'wx',mode:0o600});tempCreated=true;phase='flush';const fd=fs.openSync(temp,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}failpoint('after_flush');
  // Compare again immediately before publication; the project writer lease prevents competing writers.
  regular(fs,target);if(expectedHash!==undefined&&(fs.existsSync(target)?contentHash(fs.readFileSync(target)):null)!==expectedHash)throw new DurabilityError('STORE_CONFLICT','Store changed before publication',{phase});
  phase='publish';if(immutable)fs.linkSync(temp,target);else replaceFile(temp,target,{rename:rename??fs.renameSync,...(wait?{wait}:{})});published=true;failpoint('after_publish');phase='verify';
  regular(fs,target);if(contentHash(fs.readFileSync(target))!==hash)throw new Error('Published bytes differ');return {hash,bytes:bytes.length};
 }catch(cause){if(cause instanceof DurabilityError)throw cause;throw new DurabilityError('STORE_IO','Durable write failed; reconcile publication before further effects',{phase,outcome:published||phase==='publish'?'unknown':'not_committed',cause});}
 finally{try{if(tempCreated&&fs.existsSync(temp)){const s=fs.lstatSync(temp);if(s.isFile()&&!s.isSymbolicLink())fs.unlinkSync(temp);}}catch{/* Keep only our unused temporary artifact; never mask the original outcome. */}}
}
