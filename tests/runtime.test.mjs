import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { resolve } from 'node:path';
import { LeadPilot, loadLead, leadSkills, pilotPrompt, loadContext, contextPaths } from '../server/pilot.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { detectCli, executable, runtimeEnvironment, AppServerRpc } from '../server/rpc.mjs';
import { createBridge } from '../server/http.mjs';
import { request as httpRequest } from 'node:http';
const root = resolve('.');
function fixture({ authenticated = true, openError = false } = {}) {
  const rpc = { requests: [], responses: [], closed: false,
    async open() { if (openError) throw new Error('startup failed'); },
    async request(method, params) {
      this.requests.push({ method, params });
      if (method === 'account/read') return { account: authenticated ? { type: 'chatgpt' } : null };
      if (method === 'skills/list') return { data: [{ skills: loadLead(root).skills.map(s => ({ ...s, enabled: true })) }] };
      if (method === 'thread/start') return { thread: { id: 'thread-1' }, sandbox: { type: 'readOnly', networkAccess: false }, approvalPolicy: 'on-request', approvalsReviewer: 'user', instructionSources: [resolve('AGENTS.md')] };
      if (method === 'turn/start') { this.onNotification({ method: 'turn/started', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'inProgress' } } }); return { turn: { id: 'turn-1' } }; }
      return {};
    },
    close() { this.closed = true; this.onExit?.(); },
    respond(id, result) { this.responses.push({ id, result }); },
    reject(id) { this.responses.push({ id, rejected: true }); },
  };
  const pilot = new LeadPilot({ root, makeRpc: () => rpc, detect: async () => ({ available: true, version: 'codex-cli 0.144.5' }) });
  const notify = (method, extra = {}) => rpc.onNotification({ method, params: { threadId: 'thread-1', turnId: 'turn-1', ...extra } });
  return { pilot, rpc, notify };
}
test('CLI detection runs only fixed version argument and handles missing/unsupported CLI', async () => {
  const calls = [];
  const result = await detectCli('codex.exe', {}, async (...args) => { calls.push(args); return { stdout: 'codex-cli 0.144.5\n' }; });
  assert.equal(result.available, true); assert.deepEqual(calls[0][1], ['--version']);
  assert.equal((await detectCli('missing', {}, async () => { throw new Error(); })).available, false);
  assert.equal((await detectCli('new', {}, async () => ({ stdout: 'codex-cli 99.0.0' }))).available, false);
  assert.equal(executable({ AI_OFFICE_CODEX_BIN: '/trusted/codex' }), '/trusted/codex');
  assert.ok(runtimeEnvironment({ USERPROFILE: 'C:/User' }).CODEX_HOME.endsWith('.codex'));
});
test('Lead profile and three physical pinned Skills are read from project; no replacement profile', () => {
  const lead = loadLead(root); assert.deepEqual(lead.skills.map(s => s.name), leadSkills);
  assert.match(lead.instructions, /employee ID: lead/); assert.match(lead.profileHash, /^[a-f0-9]{64}$/);
  assert.match(pilotPrompt, /READ-ONLY/); assert.match(pilotPrompt, /Do not delegate/);
});
test('read-only context is a fixed list of complete hashed project files including actual Lead profile', () => {
  const context = loadContext(root); assert.deepEqual(context.map(f => f.path), contextPaths);
  assert.equal(context.length, 12); assert.ok(context.every(f => !/(auth\.json|\.env|password|token)/i.test(f.path)));
  for (const file of context) { assert.equal(file.text, readFileSync(resolve(root, file.path), 'utf8')); assert.equal(file.sha256, createHash('sha256').update(readFileSync(resolve(root, file.path))).digest('hex')); }
  assert.match(context.find(f => f.path.endsWith('lead-developer.toml')).text, /employee ID: lead/);
  assert.throws(() => loadContext(resolve(root, 'work/missing-context')));
});
test('connection authenticates and confirms actual discovery, disconnect closes own process', async () => {
  const { pilot, rpc } = fixture(); await pilot.connect();
  assert.equal(pilot.snapshot().connection, 'connected'); assert.equal(pilot.snapshot().authenticated, true);
  assert.deepEqual(pilot.snapshot().skills, leadSkills); assert.deepEqual(rpc.requests.map(r => r.method), ['account/read', 'skills/list', 'model/list']);
  pilot.disconnect(); assert.equal(rpc.closed, true); assert.equal(pilot.snapshot().connection, 'disconnected');
});
test('unavailable runtime, startup failure and missing auth fail closed', async () => {
  for (const options of [{ openError: true }, { authenticated: false }]) {
    const { pilot, rpc } = fixture(options); await assert.rejects(pilot.connect());
    assert.equal(pilot.snapshot().connection, 'error'); assert.equal(rpc.closed, true);
  }
  const pilot = new LeadPilot({ root, detect: async () => ({ available: false }) });
  await assert.rejects(pilot.connect(), /unavailable/); assert.equal(pilot.snapshot().skills.length, 0);
});
test('missing discovery is not accepted just because registry lists a Skill', async () => {
  const { pilot, rpc } = fixture(), original = rpc.request.bind(rpc);
  rpc.request = (m, p) => m === 'skills/list' ? Promise.resolve({ data: [{ skills: [] }] }) : original(m, p);
  await assert.rejects(pilot.connect(), /discover/); assert.equal(pilot.snapshot().connection, 'error');
});
test('thread/task submission uses exact profile, skill inputs, read-only sandbox and user approvals', async () => {
  const { pilot, rpc } = fixture(); await pilot.connect(); await pilot.start();
  const thread = rpc.requests.find(r => r.method === 'thread/start').params;
  assert.equal(thread.cwd, root); assert.equal(thread.sandbox, 'read-only'); assert.equal(thread.approvalPolicy, 'on-request'); assert.equal(thread.approvalsReviewer, 'user');
  assert.ok(thread.developerInstructions.startsWith(loadLead(root).instructions));
  const turn = rpc.requests.find(r => r.method === 'turn/start').params;
  assert.deepEqual(turn.sandboxPolicy, { type: 'readOnly', networkAccess: false });
  assert.deepEqual(turn.input.filter(x => x.type === 'skill').map(s => s.name), leadSkills);
  assert.ok(turn.input[0].text.includes(JSON.stringify(loadContext(root))));
  assert.match(thread.developerInstructions, /Do not invoke shell/);
  assert.equal(pilot.snapshot().contextFiles.length, 12); assert.ok(!('text' in pilot.snapshot().contextFiles[0]));
  assert.equal(pilot.snapshot().execution, 'working'); await assert.rejects(pilot.start(), /active task/);
});
test('unsafe sandbox response prevents submitting any turn', async () => {
  const { pilot, rpc } = fixture(), original = rpc.request.bind(rpc);
  rpc.request = async (m, p) => { const result = await original(m, p); if (m === 'thread/start') result.sandbox.type = 'dangerFullAccess'; return result; };
  await pilot.connect(); await assert.rejects(pilot.start(), /read-only/);
  assert.ok(!rpc.requests.some(r => r.method === 'turn/start')); assert.equal(rpc.closed, true);
});
test('events are scoped; final message does not mark complete before confirmed turn', async () => {
  const { pilot, notify } = fixture(); await pilot.connect(); await pilot.start();
  notify('turn/completed', { threadId: 'unrelated', turn: { id: 'foreign', status: 'completed' } }); assert.equal(pilot.snapshot().execution, 'working');
  notify('turn/plan/updated', { plan: [{ step: 'Read project', status: 'completed' }] });
  notify('item/completed', { item: { type: 'agentMessage', phase: 'commentary', text: 'interim' } }); assert.equal(pilot.snapshot().result, '');
  notify('item/completed', { item: { type: 'agentMessage', phase: 'final_answer', text: 'Structured final plan' } });
  assert.equal(pilot.snapshot().result, 'Structured final plan'); assert.equal(pilot.snapshot().execution, 'working');
  notify('turn/completed', { turn: { id: 'turn-1', status: 'completed' } }); assert.equal(pilot.snapshot().execution, 'completed');
  assert.ok(pilot.snapshot().completedAt); assert.equal(pilot.snapshot().plan[0].status, 'completed');
  assert.ok(pilot.snapshot().events.every(e => e.source === 'codex' && e.timestamp));
});
test('older runtime messages without optional phase become final only on confirmed completion', async () => {
  const { pilot, notify } = fixture(); await pilot.connect(); await pilot.start();
  notify('item/completed', { item: { type: 'agentMessage', text: 'Final plan without phase' } });
  assert.equal(pilot.snapshot().result, ''); assert.equal(pilot.snapshot().execution, 'working');
  notify('turn/completed', { turn: { id: 'turn-1', status: 'completed' } });
  assert.equal(pilot.snapshot().result, 'Final plan without phase');
});
test('approvals wait for Director and can only deny; unrelated/unsupported requests never gain permissions', async () => {
  const { pilot, rpc } = fixture(); await pilot.connect(); await pilot.start();
  for (const method of ['item/commandExecution/requestApproval', 'item/fileChange/requestApproval', 'item/permissions/requestApproval']) {
    rpc.onRequest({ id: 9, method, params: { threadId: 'thread-1' } });
    assert.equal(pilot.snapshot().execution, 'waiting'); assert.equal(rpc.responses.length, method === 'item/commandExecution/requestApproval' ? 0 : method === 'item/fileChange/requestApproval' ? 1 : 2);
    pilot.rejectApproval(); const response = rpc.responses.at(-1).result;
    assert.deepEqual(response, method === 'item/permissions/requestApproval' ? { permissions: {}, scope: 'turn' } : { decision: 'decline' });
  }
  rpc.onRequest({ id: 10, method: 'item/tool/call', params: { threadId: 'foreign' } }); assert.equal(rpc.responses.at(-1).rejected, true);
});
test('interrupt awaits runtime confirmation and disconnect during work cannot report completed', async () => {
  const { pilot, rpc, notify } = fixture(); await pilot.connect(); await pilot.start(); await pilot.interrupt();
  assert.equal(pilot.snapshot().execution, 'interrupting'); assert.equal(pilot.snapshot().completedAt, null);
  assert.equal(rpc.requests.at(-1).method, 'turn/interrupt');
  notify('turn/completed', { turn: { id: 'turn-1', status: 'interrupted' } }); assert.equal(pilot.snapshot().execution, 'interrupted');
  pilot.disconnect(); assert.equal(pilot.snapshot().execution, 'interrupted');
  const another = fixture(); await another.pilot.connect(); await another.pilot.start(); another.pilot.disconnect(); assert.equal(another.pilot.snapshot().execution, 'error');
});
test('real process exit during work becomes error and retryable event is not false completion', async () => {
  const { pilot, rpc, notify } = fixture(); await pilot.connect(); await pilot.start();
  notify('error', { willRetry: true }); assert.equal(pilot.snapshot().execution, 'working');
  rpc.onExit(); assert.equal(pilot.snapshot().execution, 'error'); assert.equal(pilot.snapshot().connection, 'error');
});
test('JSONL transport handshake, notification, request-response, timeout, exit and clean shutdown', async () => {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill() { this.killed = true; } });
  const messages = [];
  child.stdin.on('data', data => {
    for (const line of data.toString().trim().split('\n')) {
      const m = JSON.parse(line); messages.push(m);
      if (m.method === 'initialize') queueMicrotask(() => child.stdout.write(JSON.stringify({ id: m.id, result: {} }) + '\n'));
    }
  });
  const rpc = new AppServerRpc({ spawnProcess: (_b, args, options) => { assert.deepEqual(args, ['app-server', '--stdio']); assert.equal(options.shell, false); return child; }, timeoutMs: 30 });
  const notifications = [], requests = []; rpc.onNotification = m => notifications.push(m); rpc.onRequest = m => requests.push(m);
  await rpc.open(); assert.deepEqual(messages.slice(0, 2).map(m => m.method), ['initialize', 'initialized']);
  child.stdout.write('{"method":"turn/started","params":{}}\n{"id":81,"method":"item/fileChange/requestApproval","params":{}}\n');
  await new Promise(r => setImmediate(r)); assert.equal(notifications.length, 1); assert.equal(requests.length, 1);
  rpc.respond(81, { decision: 'decline' }); assert.equal(messages.at(-1).result.decision, 'decline');
  await assert.rejects(rpc.request('thread/start', {}), /timed out/);
  const pending = rpc.request('turn/start', {}); child.emit('exit', 1); await assert.rejects(pending, /exited/); assert.equal(child.killed, true);
  rpc.close(); assert.equal(rpc.pending.size, 0);
});
test('loopback HTTP rejects hostile origins, DNS rebinding, missing nonce and arbitrary shell/RPC actions', async () => {
  const { pilot } = fixture(); const bridge = createBridge({ pilot, root, port: 0 }); await bridge.listen();
  const base = `http://127.0.0.1:${bridge.server.address().port}`;
  try {
    assert.equal((await fetch(base + '/api/codex/session', { headers: { Origin: 'https://evil.example' } })).status, 403);
    const rebound = await new Promise((resolve, reject) => {
      const req = httpRequest(base + '/api/codex/session', { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end();
    });
    assert.equal(rebound, 403);
    const headers = { 'Content-Type': 'application/json' };
    assert.equal((await fetch(base + '/api/codex/action', { method: 'POST', headers, body: '{"action":"connect"}' })).status, 403);
    const { token } = await (await fetch(base + '/api/codex/session')).json(); headers['X-AI-Office-Token'] = token;
    for (const body of [{ action: 'command/exec' }, { action: 'start', prompt: 'write secrets' }, { action: 'accept' }, { action: '__proto__' }]) {
      assert.equal((await fetch(base + '/api/codex/action', { method: 'POST', headers, body: JSON.stringify(body) })).status, 400);
    }
    assert.equal((await fetch(base + '/api/codex/action', { method: 'POST', headers, body: '{"action":"connect"}' })).status, 200);
    assert.equal((await (await fetch(base + '/api/codex/snapshot')).json()).connection, 'connected');
    assert.equal((await fetch(base + '/.codex/agents/lead-developer.toml')).status, 404);
    assert.equal((await fetch(base + '/api/codex/action', { method: 'POST', headers, body: 'x'.repeat(1100) })).status, 413);
  } finally { await bridge.close(); }
});
