import type {RuntimeSnapshot} from '../integration/runtime.ts';
export function ResourcePanel({resources,mode}:{resources:RuntimeSnapshot['resources'];mode:'mock'|'codex'}){
 const r=resources,latest=r?.decisions.slice(-8)??[];
 return <details className="office-controls orchestrator-panel"><summary>Ресурсы · модели и нагрузка <span>{mode==='mock'?'MOCK · ':''}{r?.pressure??'Нет данных'}</span></summary><div className="orchestrator-body">
  <p>{mode==='mock'?'Детерминированная симуляция: mock-standard и mock-deep — тестовые профили. Реальный Codex и provider usage не используются.':'Модель и reasoning выбираются только из объявленных возможностей runtime. Неизвестные цена, скорость и лимит подписки не оцениваются.'}</p>
  {!r?<p>Анализ появится перед запуском задачи. Настройки runtime сохраняются, если каталог моделей недоступен.</p>:<>
   <p role="status">Активно: {r.activeTasks} · В очереди: {r.queuedTasks} · Параллельно: {r.parallelTaskCount}/{Math.min(r.config.maxGlobalConcurrentTasks,r.config.maxProjectConcurrentTasks)} · На паузе: {r.pausedTasks}</p>
   <p>Нагрузка: {r.pressure} · {r.pressureSource}<br/>Завершено: {r.completedTasks} · Ошибок: {r.failedTasks}</p>
   <p>Внутренняя оценка работы: {r.estimatedUsage.workUnits} усл. ед. Это не токены и не стоимость.<br/>Наблюдаемый расход: {mode==='mock'?'нет реального расхода':r.observedUsage?`${r.observedUsage.tokens} токенов из уведомлений runtime с запуска моста`:'не предоставлен runtime'}. Остаток подписки неизвестен.</p>
   {latest.map(d=><details key={d.taskId}><summary>{d.agentId} · {d.analysis.complexity} · {d.selectedModel??'Настроенная модель runtime'} · {d.selectedReasoning??'reasoning runtime'}</summary><p>Project: {d.projectId} · Task: {d.taskId}</p><p>Skill: {d.selectedSkills.join(', ')}<br/>Стратегия: {d.parallelDecision}<br/>{d.reason}</p>{d.fallback&&<p>Fallback: {d.fallback}</p>}{d.escalation&&<p>Escalation: усиление для продолжения / следующего запуска; права не расширяются.</p>}<p>Повтор: {d.retry.classification} · автоматически: {d.retry.automatic?'да, ограниченно':'нет'} · максимум {d.retry.maxRetries}<br/>Контекст: {d.context.characters??'не измерен'} символов; не оценка токенов.</p></details>)}
   <details><summary>События ресурсов · {r.events.length}</summary>{r.events.slice(-16).reverse().map(e=><p key={e.id}>{e.type} · {e.agentId} · {e.message}</p>)}</details>
  </>}
 </div></details>;
}
