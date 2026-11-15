import { useEffect, useMemo, useState } from 'react';
import type { OfficeCommand } from '../domain.ts';
import { MockCodexAdapter } from '../integration/MockCodexAdapter.ts';
import { RealCodexAdapter } from '../integration/RealCodexAdapter.ts';
import type { PilotAction, PilotOptions } from '../integration/runtime.ts';
/** React observes the adapter; commands and workflow rules live outside React. */
export function useOffice() {
  const mock = useMemo(() => new MockCodexAdapter(), []);
  const real = useMemo(() => new RealCodexAdapter(), []);
  const [mode, setMode] = useState<'mock' | 'codex'>('mock');
  const adapter = mode === 'mock' ? mock : real;
  const [state, setState] = useState(() => adapter.getSnapshot());
  const [workflow, setWorkflow] = useState(() => mock.getWorkflow());
  const [runtime, setRuntime] = useState(() => adapter.getRuntime());
  const [checkpoints,setCheckpoints] = useState(()=>adapter.getCheckpoints());
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  return { state, workflow, running, error:error??(mode==='mock'?mock.getRecoveryError():null), mode, runtime, busy, pilotAction,checkpoints,controlTask,
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
