import { configuration, team } from '../config.ts';
import { statuses, type AgentUpdate } from '../domain.ts';
import type { CodexAdapter } from './CodexAdapter.ts';
export class MockCodexAdapter implements CodexAdapter {
  readonly source = 'mock' as const;
  private listeners = new Set<(event:AgentUpdate)=>void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private step = 0;
  subscribe(listener:(event:AgentUpdate)=>void) { this.listeners.add(listener); return ()=>{this.listeners.delete(listener);}; }
  start() { if(this.timer) return; this.timer=setInterval(()=>{ const i=this.step%team.length; const cycle=Math.floor(this.step/team.length); const status=statuses[(cycle+i)%statuses.length]; const event:AgentUpdate={agentId:team[i][0],status,progress:status==='Completed'?100:(this.step*13+28)%95,timestamp:new Date().toISOString(),id:`mock-${this.step++}-${Date.now()}`}; this.listeners.forEach(listener=>listener(event)); },configuration.tickMs); }
  stop() { clearInterval(this.timer); this.timer=undefined; }
  reset() { this.stop(); this.step=0; }
}
