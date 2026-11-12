import { useEffect, useMemo, useState } from 'react';
import type { OfficeCommand } from '../domain.ts';
import { MockCodexAdapter } from '../integration/MockCodexAdapter.ts';
/** React observes the adapter; commands and workflow rules live outside React. */
export function useOffice() {
  const adapter = useMemo(() => new MockCodexAdapter(), []);
  const [state, setState] = useState(() => adapter.getSnapshot());
  const [workflow, setWorkflow] = useState(() => adapter.getWorkflow());
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => { setState(adapter.getSnapshot()); setWorkflow(adapter.getWorkflow()); };
  useEffect(() => {
    let mounted = true;
    const unsubscribe = adapter.subscribeToEvents(() => queueMicrotask(() => { if (mounted) refresh(); }));
    adapter.start();
    return () => { mounted = false; unsubscribe(); adapter.stop(); };
  }, [adapter]);
  const action = <T,>(fn: () => T): T | undefined => {
    try { setError(null); const result = fn(); refresh(); return result; }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); refresh(); }
  };
  return { state, workflow, running, error,
    dispatch: (command: OfficeCommand) => action(() => adapter.dispatch(command)),
    startWorkflow: () => action(() => { adapter.startWorkflow(); adapter.start(); setRunning(true); }),
    toggle: () => action(() => { if (running) adapter.stop(); else adapter.start(); setRunning(!running); }),
    reset: () => action(() => { adapter.reset(); if (running) adapter.start(); }),
  };
}
