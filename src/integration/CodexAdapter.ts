import type { AgentUpdate } from '../domain.ts';
// Internal AI Office contract. This is not a Codex API or protocol.
export interface CodexAdapter { readonly source: 'mock' | 'codex'; subscribe(listener:(event:AgentUpdate)=>void):()=>void; start():void; stop():void; reset():void }
