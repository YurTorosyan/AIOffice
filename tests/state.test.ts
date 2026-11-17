import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TaskSystem } from '../src/tasks/TaskSystem.ts';
import { MockCodexAdapter } from '../src/integration/MockCodexAdapter.ts';
import { metrics } from '../src/state/office.ts';
import { configuration } from '../src/config.ts';
import type { ActivityEvent } from '../src/domain.ts';
const now = '2026-11-12T09:00:00.000Z';
const later = '2026-11-12T09:01:00.000Z';
function create(system: TaskSystem, title = 'Проверить офис') { return system.dispatch({ type: 'create', title, description: 'Описание', priority: 'high' }, now)!; }
function started() { const system = new TaskSystem(); const id = create(system); system.dispatch({ type: 'assign', taskId: id, agentId: 'frontend' }, now); system.dispatch({ type: 'transition', taskId: id, status: 'in_progress' }, now); return { system, id }; }
test('initial state has exactly eight fixed workers and domain data has no presentation fields', () => {
  const state = new TaskSystem().getSnapshot(); assert.equal(state.agents.length, 8); assert.equal(new Set(state.agents.map(a => a.role)).size, 8);
  assert.equal(state.tasks.length, 0); assert.ok(state.agents.every(a => a.status === 'idle' && a.currentTask === null));
  assert.ok(!('color' in state.agents[0])); assert.deepEqual(metrics(state), { active: 0, total: 0, completed: 0, inProgress: 0, errors: 0 });
});
test('create task with required fields and emit task_created into log and subscription', () => {
  const system = new TaskSystem(); const events: ActivityEvent[] = []; system.events.subscribe(e => events.push(e)); const id = create(system, '  Новая задача  ');
  assert.deepEqual(system.getSnapshot().tasks[0], { projectId:'office-demo',branch:null,updatedAt:now,id, title: 'Новая задача', description: 'Описание', priority: 'high', status: 'pending', progress: 0, assignedAgent: null, createdAt: now, startedAt: null, completedAt: null });
  assert.equal(events[0].type, 'task_created'); assert.equal(events[0].taskId, id); assert.equal(events[0].agentId, 'lead'); assert.deepEqual(system.getSnapshot().activity, [...events].reverse());
});
test('assign task reserves worker and sets waiting/currentTask/lastActivity', () => {
  const system = new TaskSystem(), id = create(system); system.dispatch({ type: 'assign', taskId: id, agentId: 'frontend' }, later);
  const state = system.getSnapshot(); assert.equal(state.tasks[0].assignedAgent, 'frontend'); const agent = state.agents.find(a => a.id === 'frontend')!;
  assert.equal(agent.status, 'waiting'); assert.equal(agent.currentTask, id); assert.equal(agent.lastActivity, later); assert.equal(agent.startedAt, null);
  assert.ok(state.activity.some(e => e.type === 'task_assigned')); assert.ok(state.activity.some(e => e.type === 'agent_status_changed'));
});
test('starting and progress synchronize task and worker with timestamps', () => {
  const { system, id } = started(); system.dispatch({ type: 'progress', taskId: id, progress: 55 }, later);
  const state = system.getSnapshot(), agent = state.agents.find(a => a.id === 'frontend')!;
  assert.equal(state.tasks[0].status, 'in_progress'); assert.equal(agent.status, 'working'); assert.equal(agent.progress, 55); assert.equal(state.tasks[0].progress, 55); assert.equal(agent.startedAt, now); assert.equal(agent.lastActivity, later);
  assert.ok(state.activity.some(e => e.type === 'task_started')); assert.ok(state.activity.some(e => e.type === 'task_progress'));
});
test('testing hands off to QA and independent review hands off to reviewer', () => {
  const { system, id } = started(); system.dispatch({ type: 'transition', taskId: id, status: 'testing' }, later);
  let state = system.getSnapshot(); assert.equal(state.tasks[0].assignedAgent, 'qa'); assert.equal(state.agents.find(a => a.id === 'qa')!.status, 'testing'); assert.equal(state.agents.find(a => a.id === 'frontend')!.currentTask, null);
  assert.throws(() => system.dispatch({ type: 'assign', taskId: id, agentId: 'backend' }));
  system.dispatch({ type: 'transition', taskId: id, status: 'review' }); state = system.getSnapshot();
  assert.equal(state.tasks[0].assignedAgent, 'review'); assert.equal(state.agents.find(a => a.id === 'review')!.status, 'reviewing'); assert.equal(state.agents.find(a => a.id === 'qa')!.status, 'idle');
  assert.ok(state.activity.some(e => e.type === 'task_testing')); assert.ok(state.activity.some(e => e.type === 'task_review'));
});
test('completed task and worker have 100% and completion time; worker can take next task', () => {
  const { system, id } = started(); system.dispatch({ type: 'transition', taskId: id, status: 'completed' }, later);
  let state = system.getSnapshot(); assert.equal(state.tasks[0].completedAt, later); assert.equal(state.tasks[0].progress, 100);
  const agent = state.agents.find(a => a.id === 'frontend')!; assert.equal(agent.status, 'completed'); assert.equal(agent.progress, 100); assert.equal(agent.completedAt, later);
  const second = create(system); system.dispatch({ type: 'assign', taskId: second, agentId: 'frontend' }); state = system.getSnapshot(); assert.equal(state.agents.find(a => a.id === 'frontend')!.completedAt, null);
  assert.equal(metrics(state).completed, 1); assert.ok(state.activity.some(e => e.type === 'task_completed'));
});
test('failure records error state and terminal timestamp, preserving actual progress', () => {
  const { system, id } = started(); system.dispatch({ type: 'progress', taskId: id, progress: 25 }); system.dispatch({ type: 'transition', taskId: id, status: 'failed' }, later);
  const state = system.getSnapshot(); assert.equal(state.tasks[0].status, 'failed'); assert.equal(state.tasks[0].progress, 25); assert.equal(state.tasks[0].completedAt, later); assert.equal(state.agents.find(a => a.id === 'frontend')!.status, 'error'); assert.equal(metrics(state).errors, 1); assert.ok(state.activity.some(e => e.type === 'task_failed'));
});
test('busy worker rejects second assignment atomically without new events', () => {
  const { system } = started(); const id = create(system); const before = system.getSnapshot();
  assert.throws(() => system.dispatch({ type: 'assign', taskId: id, agentId: 'frontend' }), /активная задача/); assert.deepEqual(system.getSnapshot(), before);
});
test('blocked QA handoff rolls back both task and previous worker', () => {
  const { system, id } = started(); const qaTask = create(system); system.dispatch({ type: 'assign', taskId: qaTask, agentId: 'qa' }); const before = system.getSnapshot();
  assert.throws(() => system.dispatch({ type: 'transition', taskId: id, status: 'testing' })); assert.deepEqual(system.getSnapshot(), before);
});
test('invalid transitions, missing assignments and invalid progress leave no partial changes', () => {
  const system = new TaskSystem(), id = create(system); const before = system.getSnapshot();
  assert.throws(() => system.dispatch({ type: 'transition', taskId: id, status: 'in_progress' }));
  assert.throws(() => system.dispatch({ type: 'transition', taskId: id, status: 'completed' }));
  assert.throws(() => system.dispatch({ type: 'assign', taskId: id, agentId: 'director' })); assert.deepEqual(system.getSnapshot(), before);
  const active = started(); for (const progress of [NaN, Infinity, -1, 100]) assert.throws(() => active.system.dispatch({ type: 'progress', taskId: active.id, progress }));
  active.system.dispatch({ type: 'transition', taskId: active.id, status: 'completed' }); assert.throws(() => active.system.dispatch({ type: 'transition', taskId: active.id, status: 'in_progress' }));
  assert.throws(() => create(system, '   '));
});
test('agent thinking/waiting changes are logged but cannot bypass task-owned statuses', () => {
  const { system } = started(); system.dispatch({ type: 'agent_status', agentId: 'frontend', status: 'thinking' }, later);
  assert.equal(system.getSnapshot().agents.find(a => a.id === 'frontend')!.status, 'thinking'); assert.equal(system.getSnapshot().activity[0].type, 'agent_status_changed');
  assert.throws(() => system.dispatch({ type: 'agent_status', agentId: 'frontend', status: 'completed' }));
});
test('event listeners see committed state; unsubscribe and defensive copies protect data', () => {
  const adapter = new MockCodexAdapter(); let calls = 0; const unsubscribe = adapter.subscribeToEvents(event => { calls++; assert.ok(adapter.getEvents().some(e => e.id === event.id)); event.message = 'mutated'; });
  adapter.dispatch({ type: 'create', title: 'One', description: '', priority: 'normal' }); unsubscribe(); adapter.dispatch({ type: 'create', title: 'Two', description: '', priority: 'normal' });
  assert.equal(calls, 1); assert.ok(adapter.getEvents().every(e => e.message !== 'mutated')); const agents = adapter.getAgents(); agents.pop(); assert.equal(adapter.getAgents().length, 8);
});
test('activity has bounded history with unique IDs', () => {
  const system = new TaskSystem(); for (let i = 0; i < 100; i++) create(system, String(i)); const events = system.getSnapshot().activity;
  assert.equal(events.length, 80); assert.equal(new Set(events.map(e => e.id)).size, 80);
});
test('full workflow preserves roster and emits every required event in logical order', () => {
  const adapter = new MockCodexAdapter(); const events: ActivityEvent[] = []; adapter.subscribeToEvents(e => events.push(e)); adapter.startWorkflow();
  for (let i = 0; i < 8; i++) adapter.advanceWorkflow();
  const task = adapter.getTasks()[0]; assert.equal(task.status, 'completed'); assert.equal(task.assignedAgent, 'lead'); assert.equal(task.progress, 100); assert.equal(adapter.getWorkflow().status, 'completed');
  assert.equal(adapter.getAgents().length, 8); assert.equal(adapter.getAgents().find(a => a.id === 'lead')!.status, 'completed');
  assert.deepEqual(events.filter(e => ['task_created', 'task_started', 'task_testing', 'task_review', 'task_completed'].includes(e.type)).map(e => [e.type, e.agentId]), [['task_created', 'lead'], ['task_started', 'frontend'], ['task_testing', 'qa'], ['task_review', 'review'], ['task_completed', 'lead']]);
  assert.equal(adapter.getAgents().filter(a => a.currentTask === task.id).length, 1);
});
test('workflow pause/resume, duplicate start, reset and timers are safe', t => {
  t.mock.timers.enable({ apis: ['setInterval'] }); const adapter = new MockCodexAdapter(); adapter.startWorkflow(); adapter.start(); adapter.start();
  assert.throws(() => adapter.startWorkflow()); assert.throws(() => adapter.dispatch({ type: 'create', title: 'blocked', description: '', priority: 'normal' }));
  t.mock.timers.tick(configuration.tickMs); assert.equal(adapter.getWorkflow().step, 1); adapter.stop(); t.mock.timers.tick(configuration.tickMs * 3); assert.equal(adapter.getWorkflow().step, 1);
  adapter.start(); t.mock.timers.tick(configuration.tickMs); assert.equal(adapter.getWorkflow().step, 2); adapter.reset(); t.mock.timers.tick(configuration.tickMs * 10); assert.equal(adapter.getTasks().length, 0); assert.equal(adapter.getEvents().length, 0); assert.equal(adapter.getWorkflow().status, 'ready');
});
test('workflow restart creates a distinct task and busy preflight does not create orphan tasks', () => {
  const adapter = new MockCodexAdapter(); adapter.startWorkflow(); for (let i = 0; i < 8; i++) adapter.advanceWorkflow(); adapter.startWorkflow(); for (let i = 0; i < 8; i++) adapter.advanceWorkflow(); assert.equal(new Set(adapter.getTasks().map(t => t.id)).size, 2);
  adapter.reset(); const id = adapter.dispatch({ type: 'create', title: 'Busy', description: '', priority: 'normal' })!; adapter.dispatch({ type: 'assign', taskId: id, agentId: 'qa' }); assert.throws(() => adapter.startWorkflow()); assert.equal(adapter.getTasks().length, 1);
});
