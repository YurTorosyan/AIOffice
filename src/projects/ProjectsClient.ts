import {MockProjects} from './MockProjects.ts';
import {emptyProjects,validateProjectBook} from './model.ts';
import type {ProjectBook,ProjectContext} from './model.ts';
import type {PermissionRecord} from '../security/policy.ts';
export type ProjectSnapshot=ProjectBook&{error:string|null;activeContext?:ProjectContext|null;pendingGit?:PermissionRecord[]};
export type ProjectCommand={action:string;projectId?:string;name?:string;description?:string;workspaceRoot?:string;defaultBranch?:string};
export type GitCommand={action:string;projectId:string;view?:string;operation?:string;branch?:string;message?:string;paths?:string[];requestId?:string};
/** Explicit mock/real routing. Real metadata and Git never fall back to simulated success. */
export class ProjectsClient {
 private mock=new MockProjects();private real:ProjectSnapshot={...emptyProjects(),error:null,activeContext:null};private token:string|null=null;
 snapshot(mode:'mock'|'codex'):ProjectSnapshot{return mode==='mock'?this.mock.snapshot():structuredClone(this.real);}
 async refresh(mode:'mock'|'codex'){if(mode==='mock')return this.snapshot(mode);try{const r=await fetch('/api/projects/snapshot');if(!r.ok)throw new Error('Нужен мост Stage 8. Перезапустите его после обновления.');const body=await r.json();validateProjectBook(body);this.real=body;}catch(e){this.real={...this.real,error:(e as Error).message};}return this.snapshot(mode);}
 private async post(path:string,data:unknown){if(!this.token){const r=await fetch('/api/codex/session');if(!r.ok)throw new Error('Мост недоступен');this.token=(await r.json()).token;}const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-AI-Office-Token':this.token!},body:JSON.stringify(data)});if(r.status===403)this.token=null;const body=await r.json();if(!r.ok){if(body.projects){validateProjectBook(body.projects);this.real=body.projects;}throw new Error(body.error??'Операция отклонена');}return body;}
 async command(mode:'mock'|'codex',data:ProjectCommand){if(mode==='mock')return this.mock.command(data);const body=await this.post('/api/projects/action',data);validateProjectBook(body);this.real=body;return this.snapshot(mode);}
 async git(mode:'mock'|'codex',data:GitCommand){const result=mode==='mock'?await this.mock.git(data):await this.post('/api/repository/action',data);await this.refresh(mode);return result;}
}
