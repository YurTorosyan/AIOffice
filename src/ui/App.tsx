import { useEffect, useState } from 'react';
import { metrics } from '../state/office.ts';
import { useOffice } from './useOffice.ts';
import { agentView, displayStatus, taskDisplayStatus } from './presentation.ts';
import { TaskPanel } from './TaskPanel.tsx';
import { RuntimePanel } from './RuntimePanel.tsx';
import { AgentSkills } from './AgentSkills.tsx';
import { configuration } from '../config.ts';
import { statuses } from '../domain.ts';
import { Character, Office, statusColors } from './Office.tsx';

function Clock() {
 const [now,setNow]=useState(()=>new Date());
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[]);
 return <time dateTime={now.toISOString()} title="Время в Ереване">◷ {now.toLocaleTimeString('ru-RU',{timeZone:'Asia/Yerevan',hour:'2-digit',minute:'2-digit'})}</time>;
}
export function App() {
 const {state,workflow,running,error,dispatch,startWorkflow,toggle,reset,mode,runtime,busy,pilotAction,changeMode,checkpoints,controlTask}=useOffice();
 const [selected,setSelected]=useState('lead'),[filter,setFilter]=useState('all');
 const [tab,setTab]=useState<'office'|'tasks'>('office');
 const [detailTab,setDetailTab]=useState<'task'|'activity'|'stats'>('task');
 const [night,setNight]=useState(false),[still,setStill]=useState(false);
 const agents=state.agents.map(agentView),agent=agents.find(a=>a.id===selected)!;
 const task=state.tasks.find(t=>t.id===agent.currentTask),project=state.projects.find(p=>p.id===configuration.projectId)!,stats=metrics(state);
 const locked=mode==='codex'||['running','paused'].includes(workflow.status);
 const selectedRuntime=runtime.members?.[selected]??runtime;
 const connectedCount=runtime.members?Object.values(runtime.members).filter(r=>r.connection==='connected').length:(runtime.connection==='connected'?1:0);
 const employeeEvents=state.activity.filter(e=>e.agentId===selected);
 const employeeTasks=state.tasks.filter(t=>t.assignedAgent===selected);
 const alerts=state.activity.filter(e=>e.status==='error');
 const events=state.activity.filter(e=>filter==='all'||(filter==='selected'?e.agentId===selected:e.status===filter));
 const log=(items:typeof state.activity)=><div className="event-list" aria-label="Журнал событий">{!items.length&&<p className="empty-state">Пока нет событий.</p>}{items.slice(0,20).map(e=><div className="event" key={e.id}><i style={{background:statusColors[displayStatus[e.status]]}}/><time dateTime={e.timestamp}>{new Date(e.timestamp).toLocaleTimeString('ru-RU')}<small>{e.source}</small></time><div><strong>{state.agents.find(a=>a.id===e.agentId)?.role}</strong><p>{e.message}</p><small className="event-type">{e.type}</small></div></div>)}</div>;
 return <div className={`app ${running?'':'paused'} ${night?'night':''} ${still?'still':''}`}>
  <header className="topbar">
   <a className="brand" href="./" aria-label="AI Office главная"><span className="qst-logo">QST</span><span>AI Office<small>ITS NEVER LATE TO START</small></span></a>
   <label className="project-select"><span aria-hidden="true">▣</span><span className="sr-only">Текущий проект</span><select aria-label="Текущий проект" value={project.id} disabled>{state.projects.map(p=><option key={p.id} value={p.id}>Project: {p.name}</option>)}</select></label>
   <div className="header-tools"><span className="team-count" title="Сотрудников в офисе; подключение Codex указано отдельно">♟ {agents.length} / 8</span><Clock/><button className="theme-control" onClick={()=>setNight(!night)} aria-label={night?'Дневное оформление':'Ночное оформление'} aria-pressed={night}><span>{night?'☾':'☀'}</span> {night?'Night':'Day'}</button>
    <details className="header-popover"><summary aria-label="Настройки оформления" title="Настройки оформления">⚙</summary><div><strong>Оформление</strong><label><input type="checkbox" checked={still} onChange={e=>setStill(e.target.checked)}/> Уменьшить движение</label><p>Меняет только анимации. Пауза задач — в управлении офисом.</p></div></details>
    <details className="header-popover notifications"><summary aria-label={`Уведомления: ${alerts.length}`} title="События с ошибками">♧{alerts.length>0&&<b>{alerts.length}</b>}</summary><div><strong>Уведомления · {mode}</strong>{!alerts.length?<p>Событий с ошибками нет.</p>:alerts.slice(0,5).map(e=><p key={e.id}>{e.message}</p>)}</div></details>
   </div>
  </header>
  <main>
   <div className="workspace">
    <section className="office-panel" aria-label="Рабочее пространство">
     <div className="panel-toolbar"><div className="tabs"><button className={tab==='office'?'active':''} onClick={()=>setTab('office')}>▦ Офис</button><button className={tab==='tasks'?'active':''} onClick={()=>setTab('tasks')}>≡ Задачи <span>{stats.total}</span></button></div><span className="mode-label">{mode==='mock'?'MOCK · демонстрация':`CODEX · ${connectedCount}/8 подключено`}</span><div className="simulation"><span className={running?'live':''}>{running?'● LIVE':'● PAUSED'}</span><button onClick={toggle} aria-label={mode==='codex'?(running?'Пауза анимации':'Продолжить анимацию'):(running?'Пауза симуляции':'Продолжить симуляцию')}>{running?'Ⅱ Пауза':'▷ Продолжить'}</button><button disabled={mode==='codex'} onClick={reset} aria-label="Сбросить демонстрацию" title="Сбросить демонстрацию">↺</button></div></div>
     {error&&<p className="command-error" role="alert">{error}</p>}{workflow.error&&<p className="command-error" role="alert">{workflow.error}</p>}
     {tab==='office'?<><div className="scene-scroll"><Office agents={agents} selected={selected} onSelect={setSelected} runtimeSource={mode} runtimeStates={runtime.members} tasks={Object.fromEntries(state.tasks.map(t=>[t.id,t.title]))}/></div><div className="scene-footer"><span>YEREVAN, ARMENIA <span className="scene-coordinate">/ QST STUDIO</span></span><span>Выберите сотрудника в офисе ↗</span></div></>:<div className="task-list"><h2>Задачи проекта</h2>{!state.tasks.length&&<p className="empty-state">Пока нет задач. Создайте первую в Task Panel.</p>}{state.tasks.map(t=><button key={t.id} onClick={()=>{setSelected(t.assignedAgent??'lead');setTab('office');setDetailTab('task');}}><span><strong>{t.title}</strong><small>{state.agents.find(a=>a.id===t.assignedAgent)?.role??'Не назначен'} · {t.priority}</small></span><span style={{color:statusColors[taskDisplayStatus(t.status)]}}>{t.status} · {t.progressIndeterminate?'—':`${t.progress}%`} ↗</span></button>)}</div>}
     <div className="workflow-bar"><button disabled={busy} onClick={changeMode}>{mode==='mock'?'Codex team →':'← Mock mode'}</button>{mode==='mock'&&<><button onClick={startWorkflow} disabled={locked}>▷ Запустить workflow</button><span role="status">{workflow.label} · {workflow.step}/{workflow.total}{workflow.status==='paused'?' · Пауза':''}</span></>}<button disabled={busy} onClick={()=>pilotAction('connect_all')}>{mode==='mock'?'Подключить mock-сессии':'Подключить всех'}</button><button disabled={busy||connectedCount===0} onClick={()=>pilotAction('disconnect_all')}>Отключить всех</button><small>Слоты: {runtime.activeEmployees?.length??0}/{runtime.maxActive??1}</small></div>
     {runtime.teamError&&<p className="command-error" role="alert">{runtime.teamError}</p>}
     <details className="employee-control-drawer" open={mode==='codex'}><summary>{mode==='mock'?'Mock-сессии сотрудников':'Codex · управление выбранным сотрудником'}</summary><RuntimePanel runtime={selectedRuntime} busy={busy||(mode==='mock'&&['running','paused'].includes(workflow.status))} action={pilotAction} agentId={selected} role={agent.role} source={mode}/></details>
     <details className="office-controls"><summary>Task Panel · задачи и контрольные точки <span>↗</span></summary><TaskPanel checkpoints={checkpoints} control={controlTask} busy={busy} source={mode} state={state} locked={locked} dispatch={dispatch}/></details>
     <details className="status-key"><summary>Статусы сотрудников</summary><div className="legend">{statuses.map(s=><span key={s}><i style={{background:statusColors[displayStatus[s]]}}/>{displayStatus[s]}</span>)}</div></details>
    </section>
    <aside><section className="agent-panel"><div className="agent-profile"><div className="portrait"><Character agent={agent} large/></div><div><small className="section-label">СОТРУДНИК #{String(agents.findIndex(a=>a.id===agent.id)+1).padStart(2,'0')}</small><h2>{agent.role}</h2><span className="status-badge" style={{color:statusColors[agent.status],background:statusColors[agent.status]+'14'}}><i style={{background:statusColors[agent.status]}}/>{agent.status}</span><p>{agent.name}</p></div></div>
     <div className="employee-connection" aria-label="Подключение сотрудника"><i style={{background:selectedRuntime.connection==='connected'?'#7ce744':selectedRuntime.connection==='error'?'#ff777b':'#9aa4be'}}/><span>{mode==='mock'?'MOCK':'Codex'} · {selectedRuntime.connection} · {selectedRuntime.execution}</span><small>{selectedRuntime.threadId??'Нет активного thread'}</small></div>
     <div className="detail-tabs" role="tablist" aria-label="Сведения о сотруднике">{(['task','activity','stats'] as const).map((t,i)=><button key={t} role="tab" id={`employee-${t}`} aria-selected={detailTab===t} aria-controls="employee-content" tabIndex={detailTab===t?0:-1} onKeyDown={e=>{const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;setDetailTab((['task','activity','stats'] as const)[next]);(e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next])?.focus();}} onClick={()=>setDetailTab(t)}>{['Task','Activity','Stats'][i]}</button>)}</div>
     <div id="employee-content" role="tabpanel" aria-labelledby={`employee-${detailTab}`}>
      {detailTab==='task'&&<div className="task-detail"><small>CURRENT TASK</small><h3><span className="task-symbol">⌘</span>{task?.title??'Нет активной задачи'}</h3><p>{task?.description??'Сотрудник готов к работе.'}</p><div className="progress-label"><span>Прогресс</span><strong>{agent.progressIndeterminate?'Не определён':`${agent.progress}%`}</strong></div><div className={`progress-track ${agent.progressIndeterminate?'indeterminate':''}`}><div style={{width:`${agent.progress}%`}}/></div>{task&&<p className="task-meta">{task.status} · {task.priority}</p>}<div className="agent-activity">↳ {agent.activity}</div><small className="last-activity">Последняя активность: {agent.lastActivity?new Date(agent.lastActivity).toLocaleTimeString('ru-RU'):'—'}</small><h3 className="recent-heading">Recent Activity</h3><ul className="recent-activity">{employeeEvents.slice(0,3).map(e=><li key={e.id}><i style={{background:statusColors[displayStatus[e.status]]}}/>{e.message}</li>)}{!employeeEvents.length&&<li>Пока нет событий.</li>}</ul></div>}
      {detailTab==='activity'&&<div className="employee-log"><h3>Activity · {employeeEvents.length}</h3>{log(employeeEvents)}</div>}
      {detailTab==='stats'&&<div className="employee-stats"><small>Текущее состояние · {mode}</small><h3>Сотрудник</h3><dl><div><dt>Назначено задач</dt><dd>{employeeTasks.length}</dd></div><div><dt>Завершено</dt><dd>{employeeTasks.filter(t=>t.status==='completed').length}</dd></div><div><dt>Ошибки задач</dt><dd>{employeeTasks.filter(t=>t.status==='failed').length}</dd></div><div><dt>События в журнале</dt><dd>{employeeEvents.length}</dd></div><div><dt>Установлено Skills</dt><dd>{agent.skills.filter(s=>s.installationStatus==='installed').length}</dd></div></dl><h3>Проект · {project.name}</h3><dl>{[['Активные агенты',`${stats.active} / 8`],['Всего задач',stats.total],['In Progress',stats.inProgress],['Completed',stats.completed],['Errors',stats.errors]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>Задачи учитываются по текущему исполнителю. Журнал хранит последние {configuration.activityLimit} событий команды.</p></div>}
     </div>
     <div className="skill-preview"><small>ASSIGNED SKILLS</small><div>{agent.skills.map(s=><span key={s.skillId} title={`${s.installationStatus} · ${s.skillName}`}>{s.skillName}</span>)}</div></div><details className="skills-drawer"><summary>Agent Skills <span>{agent.skills.length}</span></summary><AgentSkills agent={agent} runtimeConnected={mode==='codex'&&selectedRuntime.connection==='connected'}/></details>
    </section></aside>
   </div>
   <section className="activity-panel team-activity"><div className="activity-heading"><h2>ϟ Team Activity</h2><label className="filter-label"><span className="sr-only">События</span><select aria-label="Фильтр журнала" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Вся команда</option><option value="selected">Выбранный сотрудник</option><option value="error">Только ошибки</option></select></label><span>{state.activity.length} событий</span></div>{log(events)}<div className="system-status"><span className="connection-dot"/>{mode==='mock'?'Mock mode':`Codex · ${connectedCount}/8 connected`}<small>Реальных сотрудников: {mode==='codex'?`${connectedCount} / 8`:'0 / 8'}</small><b className="qst-logo">QST</b></div></section>
  </main>
 </div>;
}
