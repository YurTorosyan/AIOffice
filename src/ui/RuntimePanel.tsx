import type {PilotAction,PilotOptions,RuntimeSnapshot} from '../integration/runtime.ts';
export function RuntimePanel({runtime:r,busy,action,agentId='lead',role='Lead Developer',source='codex'}:{runtime:RuntimeSnapshot;busy:boolean;action:(command:PilotAction,options?:PilotOptions)=>void;agentId?:string;role?:string;source?:'mock'|'codex'}){
 const active=['starting','working','waiting','interrupting','pausing','resuming'].includes(r.execution);
 const label=r.execution==='paused'?(r.pauseReason==='limit_reached'?'Paused — limit reached · Resumable':'Paused · Resumable'):r.execution;
 const send=(command:PilotAction)=>action(command,{agentId,taskId:command==='resume'?r.taskId??undefined:undefined});
 return <div className="runtime-panel" aria-label={`${source==='mock'?'Mock':'Codex'} · ${role}`}>
  <div className="runtime-controls"><strong>{role} · {source==='mock'?'MOCK':'Codex'}</strong><span role="status">{r.connection} · {label}</span>
   <button disabled={busy||r.connection==='connected'} onClick={()=>send('connect')}>Подключить</button>
   <button disabled={busy||active||r.execution==='paused'||!!r.recoveryError||r.connection!=='connected'} onClick={()=>send('start')}>{source==='mock'?'▷ Mock задание':'▷ Задание на чтение'}</button>
   <button disabled={busy||!['working','waiting'].includes(r.execution)} onClick={()=>send('pause')}>Пауза</button>
   <button disabled={busy||r.execution!=='paused'||!!r.recoveryError} onClick={()=>send('resume')}>Resume</button>
   <button disabled={busy||!['working','waiting'].includes(r.execution)} onClick={()=>send('interrupt')}>Остановить</button>
   <button disabled={busy||r.connection==='disconnected'} onClick={()=>send('disconnect')}>Отключить</button>
   {source==='mock'&&<><button disabled={busy||!active} onClick={()=>send('mock_step')}>Mock: следующий шаг</button><button disabled={busy||!active} onClick={()=>send('mock_error')}>Mock: ошибка</button><button disabled={busy||!active} onClick={()=>send('mock_limit')}>Mock: лимит</button></>}
  </div>
  <small>{source==='mock'?'Симуляция: без процесса Codex и реального выполнения Skills.':'Изолированное подключение сотрудника. Read-only · без автоматического расширения прав.'} {r.version}</small>
  <dl className="runtime-identifiers"><div><dt>Thread</dt><dd>{r.threadId??'Будет создан при запуске задания'}</dd></div><div><dt>Task</dt><dd>{r.taskId??'—'}</dd></div><div><dt>Resume</dt><dd>{r.resumeMode??'—'}</dd></div></dl>
  {r.error&&<p role="alert" className="command-error">{r.error}</p>}{r.recoveryError&&<p role="alert" className="command-error">{r.recoveryError}</p>}
  {r.approval&&<div className="runtime-approval" role="alert"><p>Ожидание Director: запрошены дополнительные права. Доступны только отказ или остановка.</p><button disabled={busy} onClick={()=>send('reject')}>Отклонить запрос</button></div>}
  {!!r.skills.length&&<details><summary>{source==='mock'?'Skills для симуляции':'Обнаруженные Codex Skills'} · {r.skills.length}</summary><p>{r.skills.join(', ')}</p><small>Профиль: {r.profile?.path??'Mock: реальный профиль не выполняется'}. В реальном режиме профиль передаётся как developer instructions, Skills — явными skill inputs при каждом запуске/продолжении. Обнаружение ещё не означает выполнение.</small></details>}
  {!!r.contextFiles.length&&<details><summary>Контекст проекта · {r.contextFiles.length} файлов</summary><p>Фиксированные снимки для этого сотрудника. Shell и расширение прав не нужны.</p><ul>{r.contextFiles.map(f=><li key={f.path}>{f.path} · {f.sha256.slice(0,12)}</li>)}</ul></details>}
  {!!r.plan.length&&<details open><summary>План {source==='mock'?'Mock':'Codex'}</summary><ol>{r.plan.map((p,i)=><li key={i}>{p.step} · {p.status}</li>)}</ol></details>}
  {r.result&&<details open><summary>{r.execution==='completed'?'Результат':'Ответ · выполнение ещё не подтверждено'}</summary><pre className="runtime-result">{r.result}</pre></details>}
 </div>;
}
