import {validateBook} from '../src/checkpoints/model.ts';
import {employeeDefinition} from './employee-config.mjs';
/** Merge one owner's partition synchronously into the existing atomic book. No per-agent stale whole-book writes. */
export class EmployeeCheckpointStorage {
 constructor(storage,agentId){employeeDefinition(agentId);this.storage=storage;this.agentId=agentId;}
 load(){const book=validateBook(this.storage.load(),'codex');return {...book,tasks:book.tasks.filter(t=>t.agentId===this.agentId),checkpoints:book.checkpoints.filter(c=>c.agentId===this.agentId)};}
 save(partition){
  const own=validateBook(partition,'codex');if([...own.tasks,...own.checkpoints].some(row=>row.agentId!==this.agentId))throw new Error('Checkpoint owner mismatch');
  const book=validateBook(this.storage.load(),'codex');
  const prior={tasks:book.tasks.filter(t=>t.agentId===this.agentId),checkpoints:book.checkpoints.filter(c=>c.agentId===this.agentId)};
  if(JSON.stringify(prior.tasks)===JSON.stringify(own.tasks)&&JSON.stringify(prior.checkpoints)===JSON.stringify(own.checkpoints))return;
  const merged={...book,tasks:[...book.tasks.filter(t=>t.agentId!==this.agentId),...own.tasks],checkpoints:[...book.checkpoints.filter(c=>c.agentId!==this.agentId),...own.checkpoints]};
  this.storage.save(validateBook(merged,'codex'));
 }
}
