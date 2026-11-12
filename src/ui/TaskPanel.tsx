import { useState } from 'react';
import type { OfficeCommand, OfficeState, Priority, TaskStatus } from '../domain.ts';
import { transitions } from '../tasks/TaskSystem.ts';
export function TaskPanel({ state, locked, dispatch }: { state: OfficeState; locked: boolean; dispatch: (command: OfficeCommand) => string | undefined }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [selected, setSelected] = useState('');
  const task = state.tasks.find(t => t.id === selected) ?? state.tasks.at(-1);
  const terminal = task?.status === 'completed' || task?.status === 'failed';
  return <section className="task-panel"><h2>Task Panel <span>{state.tasks.length}</span></h2>
    <details open={state.tasks.length === 0}><summary>Создать задачу</summary><form onSubmit={e => { e.preventDefault(); const id = dispatch({ type: 'create', title, description, priority }); if (id) { setTitle(''); setDescription(''); setSelected(id); } }}>
      <fieldset disabled={locked}><label>Новая задача<input aria-label="Название задачи" value={title} maxLength={160} required onChange={e => setTitle(e.target.value)} placeholder="Что нужно сделать?"/></label>
      <label>Описание<textarea aria-label="Описание задачи" value={description} maxLength={2000} onChange={e => setDescription(e.target.value)} rows={2}/></label>
      <div className="task-create-row"><label>Приоритет<select aria-label="Приоритет задачи" value={priority} onChange={e => setPriority(e.target.value as Priority)}><option value="low">Низкий</option><option value="normal">Обычный</option><option value="high">Высокий</option></select></label><button type="submit">+ Создать</button></div></fieldset>
    </form></details>
    {task ? <div className="task-controls"><label>Задача<select aria-label="Выбор задачи" value={task.id} onChange={e => setSelected(e.target.value)}>{state.tasks.map(t => <option value={t.id} key={t.id}>{t.title}</option>)}</select></label><p className="task-summary">{task.status} · {task.progress}% · {task.priority}</p>
    {!terminal && <fieldset disabled={locked}><label>Исполнитель<select aria-label="Назначить сотрудника" value={task.assignedAgent ?? ''} onChange={e => dispatch({ type: 'assign', taskId: task.id, agentId: e.target.value })}><option value="" disabled>Не назначен</option>{state.agents.map(a => <option value={a.id} key={a.id}>{a.role}</option>)}</select></label>
    <label>Следующий статус<select aria-label="Изменить статус задачи" value="" onChange={e => dispatch({ type: 'transition', taskId: task.id, status: e.target.value as TaskStatus })}><option value="" disabled>Выберите действие</option>{transitions[task.status].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
    <button type="button" disabled={task.status !== 'in_progress' || task.progress >= 99} onClick={() => dispatch({ type: 'progress', taskId: task.id, progress: Math.min(99, task.progress + 25) })}>Прогресс +25%</button></fieldset>}
    {terminal && <p className="empty-state">Исполнитель: {state.agents.find(a => a.id === task.assignedAgent)?.role ?? '—'}. Задача закрыта.</p>}
    <small>Создана: {new Date(task.createdAt).toLocaleTimeString('ru-RU')}</small>
    </div> : <p className="empty-state">Создайте задачу или запустите mock workflow.</p>}
    {locked && <p className="empty-state">Задачами управляет workflow. Пауза сохраняет этот режим; сброс отменяет его.</p>}
  </section>;
}
