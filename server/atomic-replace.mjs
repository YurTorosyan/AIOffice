import {renameSync} from 'node:fs';
/** Retry only transient Windows replacement locks. Never delete the destination or rerun an effect. */
export function replaceFile(source,target,{rename=renameSync,wait=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms)}={}){
 for(let attempt=0;;attempt++){try{return rename(source,target);}catch(error){if(attempt===4||!['EPERM','EACCES','EBUSY','EEXIST'].includes(error.code))throw error;wait(15*(attempt+1));}}
}
