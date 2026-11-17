import {WorkspaceBoundary} from './permissions.mjs';
import {existsSync,readFileSync,writeFileSync,mkdirSync,lstatSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {replaceFile} from './atomic-replace.mjs';
import {safeText} from '../src/checkpoints/model.ts';
import {validateProjectBook,emptyProjects} from '../src/projects/model.ts';
export const validateProjects=validateProjectBook;
export class ProjectFileStorage {
 constructor(root){this.boundary=new WorkspaceBoundary(root);this.root=realpathSync(root);this.dir=resolve(this.root,'.ai-office');this.file=resolve(this.dir,'projects.json');}
 check(){this.boundary.path('.ai-office');for(const path of [this.dir,this.file]){try{if(lstatSync(path).isSymbolicLink())throw new Error('Unsafe project registry path');}catch(e){if(e.code!=='ENOENT')throw e;}}}
 load(){this.check();if(!existsSync(this.file))return emptyProjects();const bytes=readFileSync(this.file);if(bytes.length>2000000)throw new Error('Project registry too large');return validateProjects(JSON.parse(bytes));}
 save(book){const data=validateProjects(book);this.check();mkdirSync(this.dir,{recursive:true,mode:0o700});this.check();const temp=resolve(this.dir,`projects-${randomUUID()}.tmp`);writeFileSync(temp,JSON.stringify(data),{flag:'wx',mode:0o600});replaceFile(temp,this.file);}
}
export class MemoryProjectStorage {constructor(){this.book=emptyProjects();}load(){return structuredClone(this.book);}save(book){this.book=validateProjects(book);}}
