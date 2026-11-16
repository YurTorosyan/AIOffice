import { useEffect, useMemo, useState } from 'react';
import type { OfficeCommand } from '../domain.ts';
import { MockCodexAdapter } from '../integration/MockCodexAdapter.ts';
import { RealCodexAdapter } from '../integration/RealCodexAdapter.ts';
import type { PilotAction, PilotOptions } from '../integration/runtime.ts';
import { WorkflowClient } from '../orchestration/WorkflowClient.ts';
/** React observes the adapter; commands and workflow rules live outside React. */
export function useOffice() {
  const mock = useMemo(() => new MockCodexAdapter(), []);
  const real = useMemo(() => new RealCodexAdapter(), []);
  const orchestrationClient=useMemo(()=>new WorkflowClient(mock),[mock]);
  const [mode, setMode] = useState<'mock' | 'codex'>('mock');
  const adapter = mode === 'mock' ? mock : real;
  const [state, setState] = useState(() => adapter.getSnapshot());
  const [workflow, setWorkflow] = useState(() => mock.getWorkflow());
  const [runtime, setRuntime] = useState(() => adapter.getRuntime());
  const [checkpoints,setCheckpoints] = useState(()=>adapter.getCheckpoints());
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orchestration,setOrchestration]=useState(()=>orchestrationClient.snapshot(mode));
  const refreshOrchestration=()=>{setOrchestration(orchestrationClient.snapshot(mode));refresh();};
  useEffect(()=>{let alive=true,busy=false;const poll=async()=>{if(busy)return;busy=true;try{await orchestrationClient.refresh(mode);if(alive){setOrchestration(orchestrationClient.snapshot(mode));refresh();}}catch{/* Workflow panel remains inspectable offline. Commands report connection failures. */}finally{busy=false;}};void poll();const timer=setInterval(poll,1000);return()=>{alive=false;clearInterval(timer);};},[mode,orchestrationClient]);
  const refresh = () => { setState(adapter.getSnapshot()); setWorkflow(mock.getWorkflow()); setRuntime(adapter.getRuntime()); setCheckpoints(adapter.getCheckpoints()); };
  useEffect(() => {
    let mounted = true;
    const onUpdate = () => queueMicrotask(() => { if (mounted) refresh(); });
    const unsubscribe = mode === 'mock' ? mock.subscribeToEvents(onUpdate) : real.subscribeToUpdates(onUpdate);
    refresh();
    if (mode === 'mock') { if (running) mock.start(); } else real.observe();
    return () => { mounted = false; unsubscribe(); mock.stop(); real.stopObserving(); };
  }, [adapter]);
  const action = <T,>(fn: () => T): T | undefined => {
    try { setError(null); const result = fn(); refresh(); return result; }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); refresh(); }
  };
  const pilotAction = async (command: PilotAction,options?:PilotOptions) => {
    setBusy(true); setError(null);
    try { await adapter.action(command,options); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); refresh(); }
  };
  const controlTask=async(command:string,taskId?:string)=>{setBusy(true);setError(null);try{await adapter.controlTask(command,taskId);}catch(cause){setError(cause instanceof Error?cause.message:String(cause));}finally{setBusy(false);refresh();}};
  const workflowActivity=orchestration.events.map(e=>({id:e.id,type:'runtime_event' as const,agentId:e.agentId,taskId:e.taskId,message:`${e.type} · ${e.message}`,timestamp:e.timestamp,status:e.type.includes('failed')?'error' as const:e.type.includes('completed')?'completed' as const:'waiting' as const,source:e.source,runtimeMethod:e.type}));
  const securityActivity=(mode==='codex'?orchestrationClient.security.events:[]).map(e=>({id:e.id,type:'runtime_event' as const,agentId:e.agentId,taskId:e.taskId,message:`Security · ${e.type} · ${e.action} · ${e.reason}`,timestamp:e.timestamp,status:e.type.includes('denied')||e.type.includes('failed')?'error' as const:'waiting' as const,source:'codex' as const,runtimeMethod:e.type}));
  const combinedState={...state,activity:[...state.activity,...workflowActivity,...securityActivity].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,80)};
  return { state:combinedState, orchestration,orchestrationClient,refreshOrchestration, workflow, running, error:error??(mode==='mock'?mock.getRecoveryError():null), mode, runtime, busy, pilotAction,checkpoints,controlTask,
    changeMode: async () => {
      setBusy(true); setError(null);
      try { await adapter.action('disconnect_all'); setMode(mode === 'mock' ? 'codex' : 'mock'); }
      catch { setError('Не удалось закрыть подключение. Остановите мост перед переключением.'); }
      finally { setBusy(false); }
    },
    dispatch: (command: OfficeCommand) => action(() => adapter.dispatch(command)),
    startWorkflow: () => action(() => { mock.startWorkflow(); mock.start(); setRunning(true); }),
    toggle: () => action(() => { if (mode === 'mock') { if (running) mock.stop(); else mock.start(); } setRunning(!running); }),
    reset: () => action(() => { mock.reset(); if (running) mock.start(); }),
  };
}
