import type { PilotAction, PilotOptions, RuntimeSnapshot } from '../integration/runtime.ts';
export function RuntimePanel({ runtime: r, busy, action }: { runtime: RuntimeSnapshot; busy: boolean; action: (command: PilotAction,options?:PilotOptions) => void }) {
  const active = ['starting', 'working', 'waiting', 'interrupting','pausing','resuming'].includes(r.execution);
  const label=r.execution==='paused'?(r.pauseReason==='limit_reached'?'Paused — limit reached · Resumable':'Paused · Resumable'):r.execution==='resuming'?'Resuming':r.execution;
  return <div className="runtime-panel" aria-label="Codex Lead pilot">
    <div className="runtime-controls"><strong>Lead · Codex</strong><span role="status">{r.connection} · {label}</span>
      <button disabled={busy || r.connection === 'connected'} onClick={() => action('connect')}>Подключить</button>
      <button disabled={busy || active || r.execution==='paused' || !!r.recoveryError || r.connection !== 'connected'} onClick={() => action('start')}>▷ Задание на чтение</button>
      <button disabled={busy || !['working','waiting'].includes(r.execution)} onClick={()=>action('pause')}>Пауза</button>
      <button disabled={busy || r.execution!=='paused'||!!r.recoveryError} onClick={()=>action('resume')}>Resume</button>
      <button disabled={busy || !['working', 'waiting'].includes(r.execution)} onClick={() => action('interrupt')}>Остановить</button>
      <button disabled={busy || r.connection === 'disconnected'} onClick={() => action('disconnect')}>Отключить</button>
    </div>
    <small>Только Lead Developer. Остальные 7 не подключены. Read-only · без расширения прав. {r.version}</small>
    {r.error && <p role="alert" className="command-error">{r.error}</p>}
    {r.recoveryError&&<p role="alert" className="command-error">{r.recoveryError}</p>}
    {r.approval && <div className="runtime-approval" role="alert"><p>Ожидание Director: запрошены дополнительные права. Пилот разрешает только отказ или остановку.</p><button disabled={busy} onClick={() => action('reject')}>Отклонить запрос</button></div>}
    {!!r.skills.length && <details><summary>Обнаруженные Codex Skills · {r.skills.length}</summary><p>{r.skills.join(', ')}</p><small>Профиль: {r.profile?.path} · явно передан как developer instructions. Вызов Skills отправляется с заданием; обнаружение ещё не означает выполнение.</small></details>}
    {!!r.contextFiles?.length && <details><summary>Контекст проекта · {r.contextFiles.length} файлов</summary><p>Мост передал фиксированные снимки файлов для чтения. Shell и расширение прав не нужны.</p><ul>{r.contextFiles.map(file => <li key={file.path}>{file.path} · {file.sha256.slice(0,12)}</li>)}</ul></details>}
    {!!r.plan.length && <details open><summary>План Codex</summary><ol>{r.plan.map((step, i) => <li key={i}>{step.step} · {step.status}</li>)}</ol></details>}
    {r.result && <details open><summary>{r.execution === 'completed' ? 'Результат Codex' : 'Ответ Codex · выполнение ещё не подтверждено'}</summary><pre className="runtime-result">{r.result}</pre></details>}
  </div>;
}
