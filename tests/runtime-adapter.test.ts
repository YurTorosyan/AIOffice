import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyRuntime, projectRuntime, RealCodexAdapter } from '../src/integration/RealCodexAdapter.ts';
import { MockCodexAdapter } from '../src/integration/MockCodexAdapter.ts';
import { LocalBridgeTransport } from '../src/integration/runtime.ts';
import type { RuntimeSnapshot } from '../src/integration/runtime.ts';
test('real projection preserves eight workers, indeterminate progress and only changes Lead', () => {
  const runtime: RuntimeSnapshot = { ...emptyRuntime(), connection: 'connected', execution: 'working', startedAt: '2026-11-13T00:00:00.000Z' };
  const state = projectRuntime(runtime); assert.equal(state.agents.length, 8); assert.ok(state.agents.slice(1).every(a => a.status === 'idle' && a.currentTask === null));
  assert.equal(state.agents[0].status, 'working'); assert.equal(state.agents[0].progressIndeterminate, true); assert.equal(state.tasks[0].status, 'in_progress');
  runtime.execution = 'waiting'; assert.equal(projectRuntime(runtime).agents[0].status, 'waiting');
  runtime.execution = 'completed'; runtime.completedAt = '2026-11-13T00:01:00.000Z';
  assert.equal(projectRuntime(runtime).tasks[0].status, 'completed'); assert.equal(projectRuntime(runtime).agents[0].progress, 100);
  runtime.execution = 'error'; assert.equal(projectRuntime(runtime).tasks[0].status, 'failed');
});
test('real adapter conforms to shared contract and transport failure does not generate success', async () => {
  let snapshot = emptyRuntime(); const calls: string[] = [];
  const adapter = new RealCodexAdapter({ snapshot: async () => snapshot, action: async action => { calls.push(action); return snapshot; } });
  let notifications = 0; const unsubscribe = adapter.subscribeToUpdates(() => notifications++);
  await adapter.action('connect'); assert.deepEqual(calls, ['connect']);
  snapshot = { ...snapshot, connection: 'connected', execution: 'working', startedAt: new Date().toISOString() }; await adapter.refresh();
  assert.equal(adapter.getAgents()[0].status, 'working'); assert.equal(adapter.getTasks().length, 1); assert.equal(adapter.getEvents().length, 0);
  assert.throws(() => adapter.dispatch({ type: 'create', title: 'x', description: '', priority: 'normal' }), /pilot/);
  assert.ok(notifications >= 2); unsubscribe(); adapter.stopObserving();
  const broken = new RealCodexAdapter({ snapshot: async () => { throw new Error('offline'); }, action: async () => { throw new Error('offline'); } });
  await broken.refresh(); assert.equal(broken.getRuntime().connection, 'error'); assert.notEqual(broken.getRuntime().execution, 'completed');
});
test('real event subscribers receive every new event once in runtime order, without fabricated polling events', async () => {
  const snapshot = emptyRuntime();
  const adapter = new RealCodexAdapter({ snapshot: async () => snapshot, action: async () => snapshot });
  const received: string[] = []; const unsubscribe = adapter.subscribeToEvents(event => received.push(event.id));
  await adapter.refresh(); assert.deepEqual(received, []);
  snapshot.events.push(...['one', 'two'].map(id => ({ id, method: 'item/started', message: id, timestamp: '2026-11-13T00:00:00Z', source: 'codex' as const, threadId: 'thread', turnId: 'turn', execution: 'working' as const, taskStartedAt: null })));
  await adapter.refresh(); await adapter.refresh(); assert.deepEqual(received, ['one', 'two']);
  unsubscribe(); snapshot.events.push({ ...snapshot.events[0], id: 'three' }); await adapter.refresh(); assert.deepEqual(received, ['one', 'two']);
});
test('mock works with no Codex process, bridge or transport and keeps its original workflow', () => {
  const mock = new MockCodexAdapter(); mock.startWorkflow(); for (let i = 0; i < 8; i++) mock.advanceWorkflow();
  assert.equal(mock.source, 'mock'); assert.equal(mock.getSnapshot().agents.length, 8); assert.equal(mock.getTasks()[0].status, 'completed'); assert.ok(mock.getEvents().every(e => e.source === 'mock')); mock.stop();
});
test('HTTP transport obtains a CSRF session, never sends runtime credentials, and surfaces bridge failures', async () => {
  const calls: { url: string; options: RequestInit | undefined }[] = [];
  const request = (async (url: string | URL | Request, options?: RequestInit) => {
    calls.push({ url: String(url), options }); return new Response(JSON.stringify(String(url).endsWith('session') ? { token: 'local-nonce' } : emptyRuntime()), { status: 200 });
  }) as typeof fetch;
  const transport = new LocalBridgeTransport(request); await transport.action('connect');
  assert.deepEqual(calls.map(c => c.url), ['/api/codex/session', '/api/codex/action']);
  assert.equal(calls[1].options?.body, '{"action":"connect"}'); assert.equal((calls[1].options?.headers as Record<string, string>)['X-AI-Office-Token'], 'local-nonce');
  const offline = new LocalBridgeTransport((async () => new Response('', { status: 404 })) as typeof fetch);
  await assert.rejects(offline.snapshot(), /недоступен/);
});
test('default fetch is invoked without binding the browser native function to the transport instance', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async function () { assert.equal(this, undefined); return new Response(JSON.stringify(emptyRuntime())); };
  try { assert.equal((await new LocalBridgeTransport().snapshot()).execution, 'idle'); }
  finally { globalThis.fetch = original; }
});
