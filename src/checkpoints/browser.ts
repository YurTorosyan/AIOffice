import { emptyBook, validateBook, type RecoveryBook, type CheckpointStorage } from './model.ts';
/** Mock-only storage; real checkpoints belong to the Node bridge and never localStorage. */
export class BrowserCheckpointStorage implements CheckpointStorage {
  private key:string;
  constructor(projectId='office-demo') {this.key=projectId==='office-demo'?'ai-office:mock-checkpoints:v1':`ai-office:mock-checkpoints:v1:${projectId}`;}
  load() { const raw = localStorage.getItem(this.key); if (raw && raw.length > 4_000_000) throw new Error('Mock recovery file too large'); return raw?validateBook(JSON.parse(raw),'mock'):emptyBook('mock'); }
  save(book: RecoveryBook) { localStorage.setItem(this.key,JSON.stringify(validateBook(book,'mock'))); }
}
