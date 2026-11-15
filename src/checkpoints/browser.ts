import { emptyBook, validateBook, type RecoveryBook, type CheckpointStorage } from './model.ts';
/** Mock-only storage; real checkpoints belong to the Node bridge and never localStorage. */
export class BrowserCheckpointStorage implements CheckpointStorage {
  constructor() {}
  load() { const raw = localStorage.getItem('ai-office:mock-checkpoints:v1'); if (raw && raw.length > 4_000_000) throw new Error('Mock recovery file too large'); return raw?validateBook(JSON.parse(raw),'mock'):emptyBook('mock'); }
  save(book: RecoveryBook) { localStorage.setItem('ai-office:mock-checkpoints:v1',JSON.stringify(validateBook(book,'mock'))); }
}
