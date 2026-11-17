import {backupLegacyBook} from './migration-backup.mjs';
import {WorkspaceBoundary} from './permissions.mjs';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, lstatSync, realpathSync, openSync, fsyncSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { emptyBook, validateBook } from '../src/checkpoints/model.ts';
/** One atomic local JSON file, never a database or a credentials store. */
export class FileCheckpointStorage {
  constructor(root, {rename = renameSync, wait = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms)} = {}) {
    this.rename = rename; this.wait = wait;
    this.boundary=new WorkspaceBoundary(root);this.root = realpathSync(root); this.directory = resolve(this.root,'.ai-office'); this.file = resolve(this.directory,'recovery.json');
  }
  check() {this.boundary.path('.ai-office');
    if (existsSync(this.directory) && (lstatSync(this.directory).isSymbolicLink() || relative(this.root,realpathSync(this.directory)).startsWith('..'))) throw new Error('Unsafe recovery directory');
    if (existsSync(this.file) && lstatSync(this.file).isSymbolicLink()) throw new Error('Unsafe recovery file');
  }
  load() {
    this.check();
    if (!existsSync(this.file)) return emptyBook('codex');
    const bytes = readFileSync(this.file); if (bytes.length > 8_000_000) throw new Error('Recovery file too large');
    const raw=JSON.parse(bytes.toString('utf8'));this.legacy=raw.checkpoints?.some(c=>!c.workspaceRoot);return validateBook(raw,'codex');
  }
  save(book) {
    const safe = validateBook(book,'codex'); this.check(); mkdirSync(this.directory,{ recursive:true,mode:0o700 }); this.check();
    const bytes = Buffer.from(JSON.stringify(safe,null,2)+'\n');
    if (bytes.length > 8_000_000) throw new Error('Recovery file too large');
    backupLegacyBook(this.file,this.legacy);this.legacy=false;const temporary = resolve(this.directory,`recovery-${randomUUID()}.tmp`);
    writeFileSync(temporary,bytes,{ flag:'wx',mode:0o600 });
    const fd = openSync(temporary,'r+'); try { fsyncSync(fd); } finally { closeSync(fd); }
    try {
      // Windows scanners can briefly hold the destination. Keep replacement atomic; never unlink the live book.
      for(let attempt=0;;attempt++){
        try { this.rename(temporary,this.file);break; }
        catch(error){if(attempt===4||!['EPERM','EACCES','EBUSY','EEXIST'].includes(error.code))throw error;this.wait(15*(attempt+1));}
      }
    } finally { if(existsSync(temporary))unlinkSync(temporary); }
  }
  acquireLock() {
    this.check();mkdirSync(this.directory,{recursive:true,mode:0o700});this.check();
    const lock=resolve(this.directory,'bridge.lock');const token=randomUUID();
    if(existsSync(lock)) {
      if(lstatSync(lock).isSymbolicLink())throw new Error('Unsafe bridge lock');
      const text=readFileSync(lock,'utf8');if(text.length>200)throw new Error('Invalid bridge lock');
      const owner=JSON.parse(text);if(!Number.isSafeInteger(owner.pid)||owner.pid<1)throw new Error('Invalid bridge lock');
      let alive=true;try{process.kill(owner.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;}
      if(alive)throw new Error('Another bridge owns this project recovery file');
      unlinkSync(lock); // Only this fixed, checked stale lock file; never a recursive operation.
    }
    writeFileSync(lock,JSON.stringify({pid:process.pid,token}),{flag:'wx',mode:0o600});
    return ()=>{if(existsSync(lock)&&!lstatSync(lock).isSymbolicLink()){const owner=JSON.parse(readFileSync(lock,'utf8'));if(owner.token===token)unlinkSync(lock);}};
  }
}
