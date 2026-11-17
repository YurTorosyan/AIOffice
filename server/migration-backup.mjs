import {copyFileSync,existsSync,lstatSync,constants} from 'node:fs';
/** Preserve the original legacy book before the first additive Stage 8 rewrite. */
export function backupLegacyBook(file,legacy){
 if(!legacy||!existsSync(file))return;
 const backup=file+'.pre-stage8.bak';
 if(existsSync(backup)){if(lstatSync(backup).isSymbolicLink())throw new Error('Unsafe migration backup');return;}
 copyFileSync(file,backup,constants.COPYFILE_EXCL);
}
