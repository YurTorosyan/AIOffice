import type {ProjectContext} from '../projects/model.ts';
import {MemoryCheckpointStorage} from '../checkpoints/model.ts';
import { useEffect, useMemo, useState } from 'react';
import type { OfficeCommand } from '../domain.ts';
import { MockCodexAdapter } from '../integration/MockCodexAdapter.ts';
import { RealCodexAdapter } from '../integration/RealCodexAdapter.ts';
import type { PilotAction, PilotOptions } from '../integration/runtime.ts';
import { WorkflowClient } from '../orchestration/WorkflowClient.ts';
/** React observes the adapter; commands and workflow rules live outside React. */
export function useOffice(options?:{context?:ProjectContext;mode?:'mock'|'codex';onModeChange?:()=>Promise<void>;available?:boolean;selected?:boolean}) {
  const mock = useMemo(() => new MockCodexAdapter(options?.selected===false||options?.mode==='codex'?new MemoryCheckpointStorage():undefined,options?.context,options?.selected!==false&&options?.mode!=='codex'), [options?.context?.projectId]);
  const real = useMemo(() => new RealCodexAdapter(undefined,options?.context), [options?.context?.projectId]);
  const orchestrationClient=useMemo(()=>new WorkflowClient(mock,options?.context,options?.selected!==false&&options?.mode!=='codex'),[mock]);
  const [localMode,setMode]=useState<'mock'|'codex'>('mock');const mode=options?.mode??localMode;
  useEffect(()=>{if(options?.context){mock.updateProjectContext(options.context);orchestrationClient.updateProjectContext(options.context);}},[options?.context,mock,orchestrationClient]);
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
  useEffect(()=>{let alive=true,busy=false;const poll=async()=>{if(options?.selected===false||busy)return;busy=true;try{await orchestrationClient.refresh(mode);if(alive){setOrchestration(orchestrationClient.snapshot(mode));refresh();}}catch{/* Workflow panel remains inspectable offline. Commands report connection failures. */}finally{busy=false;}};void poll();const timer=setInterval(poll,1000);return()=>{alive=false;clearInterval(timer);};},[mode,orchestrationClient]);
  const refresh = () => { setState(adapter.getSnapshot()); setWorkflow(mock.getWorkflow()); setRuntime(adapter.getRuntime()); setCheckpoints(adapter.getCheckpoints()); };
  useEffect(() => {
    let mounted = true;
    const onUpdate = () => queueMicrotask(() => { if (mounted) refresh(); });
    const unsubscribe = mode === 'mock' ? mock.subscribeToEvents(onUpdate) : real.subscribeToUpdates(onUpdate);
    refresh();
    if (mode === 'mock') { if (running&&options?.selected!==false) mock.start(); } else if(options?.selected!==false)real.observe();
    return () => { mounted = false; unsubscribe(); mock.stop(); real.stopObserving(); };
  }, [adapter]);
  const action = <T,>(fn: () => T): T | undefined => {
    try { setError(null); const result = fn(); refresh(); return result; }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); refresh(); }
  };
  const pilotAction = async (command: PilotAction,pilotOptions?:PilotOptions) => {
    setBusy(true); setError(null);
    try {if(options?.available===false&&!['pause','interrupt','reject','disconnect','disconnect_all','checkpoint'].includes(command))throw new Error('Выберите доступный проект');await adapter.action(command,pilotOptions); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); refresh(); }
  };
  const controlTask=async(command:string,taskId?:string)=>{setBusy(true);setError(null);try{await adapter.controlTask(command,taskId);}catch(cause){setError(cause instanceof Error?cause.message:String(cause));}finally{setBusy(false);refresh();}};
  const workflowActivity=orchestration.events.map(e=>({projectId:e.projectId??options?.context?.projectId,branch:e.branch,id:e.id,type:'runtime_event' as const,agentId:e.agentId,taskId:e.taskId,message:`${e.type} · ${e.message}`,timestamp:e.timestamp,status:e.type.includes('failed')?'error' as const:e.type.includes('completed')?'completed' as const:'waiting' as const,source:e.source,runtimeMethod:e.type}));
  const securityActivity=(mode==='codex'?orchestrationClient.security.events:[]).map(e=>({projectId:e.projectId??options?.context?.projectId,id:e.id,type:'runtime_event' as const,agentId:e.agentId,taskId:e.taskId,message:`Security · ${e.type} · ${e.action} · ${e.reason}`,timestamp:e.timestamp,status:e.type.includes('denied')||e.type.includes('failed')?'error' as const:'waiting' as const,source:'codex' as const,runtimeMethod:e.type}));
  const combinedState={...state,activity:[...state.activity,...workflowActivity,...securityActivity].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,80)};
  const prepareProjectSwitch=async()=>{if(mode==='codex'){if(runtime.activeEmployees?.length||orchestration.workflows.some(w=>!['completed','cancelled','paused'].includes(w.status)))throw new Error('Сначала приостановите задания и workflow текущего проекта');return;}await orchestrationClient.pauseForSwitch();for(const task of mock.getTasks().filter(t=>!['completed','failed','pending','paused'].includes(t.status)))mock.pauseTask(task.id);mock.stop();await mock.action('disconnect_all');};
  return {prepareProjectSwitch,state:combinedState, orchestration,orchestrationClient,refreshOrchestration, workflow, running, error:error??(mode==='mock'?mock.getRecoveryError():null), mode, runtime, busy, pilotAction,checkpoints,controlTask,
    changeMode: async () => {
      setBusy(true); setError(null);
      try { await adapter.action('disconnect_all');if(options?.onModeChange)await options.onModeChange();else setMode(mode === 'mock' ? 'codex' : 'mock'); }
      catch { setError('Не удалось закрыть подключение. Остановите мост перед переключением.'); }
      finally { setBusy(false); }
    },
    dispatch: (command: OfficeCommand) => action(() => adapter.dispatch(command)),
    startWorkflow: () => action(() => { mock.startWorkflow(); mock.start(); setRunning(true); }),
    toggle: () => action(() => { if (mode === 'mock') { if (running) mock.stop(); else mock.start(); } setRunning(!running); }),
    reset: () => action(() => { mock.reset(); if (running&&options?.selected!==false) mock.start(); }),
  };
}
