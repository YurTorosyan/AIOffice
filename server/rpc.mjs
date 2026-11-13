import { spawn, execFile } from 'node:child_process';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { join } from 'node:path';
const execute = promisify(execFile);
export function executable(env = process.env, platform = process.platform) {
  return env.AI_OFFICE_CODEX_BIN || (platform === 'win32'
    ? join(env.LOCALAPPDATA || '', 'Programs/OpenAI/Codex/bin/codex.exe') : 'codex');
}
export function runtimeEnvironment(env = process.env) {
  return { ...env, ...(env.CODEX_HOME ? {} : env.USERPROFILE ? { CODEX_HOME: join(env.USERPROFILE, '.codex') } : {}) };
}
export async function detectCli(bin = executable(), env = runtimeEnvironment(), run = execute) {
  try {
    const { stdout } = await run(bin, ['--version'], { env, windowsHide: true, timeout: 10000 });
    const version = stdout.trim();
    if (version !== 'codex-cli 0.144.5') throw new Error('Protocol reviewed only for codex-cli 0.144.5');
    return { available: true, version };
  } catch { return { available: false, version: null }; }
}
/** Only the bridge calls this transport. Never expose a generic RPC endpoint. */
export class AppServerRpc {
  constructor({ bin = executable(), env = runtimeEnvironment(), spawnProcess = spawn, timeoutMs = 20000 } = {}) {
    Object.assign(this, { bin, env, spawnProcess, timeoutMs });
    this.pending = new Map(); this.sequence = 0; this.closed = false;
    this.onNotification = () => {}; this.onRequest = () => {}; this.onExit = () => {};
  }
  async open() {
    this.child = this.spawnProcess(this.bin, ['app-server', '--stdio'], { env: this.env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on('line', line => {
      if (line.length > 4_000_000) return this.close();
      try {
        const message = JSON.parse(line);
        if (message.method) {
          if (message.id !== undefined) this.onRequest(message); else this.onNotification(message);
        } else {
          const request = this.pending.get(message.id);
          if (!request) return;
          clearTimeout(request.timer); this.pending.delete(message.id);
          // Do not forward arbitrary runtime error text, command output or account data to the browser.
          message.error ? request.reject(new Error(`Codex rejected request (${message.error.code})`)) : request.resolve(message.result);
        }
      } catch { this.fail(new Error('Invalid app-server message')); }
    });
    this.child.stderr.on('data', () => {}); // Local Codex owns diagnostics; never relay raw stderr.
    this.child.stdin.on('error', () => this.fail(new Error('Codex input closed')));
    this.child.on('error', () => this.fail(new Error('Could not start Codex executable')));
    this.child.on('exit', () => this.fail(new Error('Codex exited; check local account and filesystem permissions')));
    await this.request('initialize', { clientInfo: { name: 'ai_office', version: '0.4.0' }, capabilities: { experimentalApi: false } });
    this.send({ method: 'initialized', params: {} });
  }
  send(message) {
    if (!this.child || this.closed) throw new Error('Codex is disconnected');
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }
  request(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Codex request timed out: ${method}`)); }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  respond(id, result) { this.send({ id, result }); }
  reject(id) { this.send({ id, error: { code: -32601, message: 'Unsupported in read-only AI Office pilot' } }); }
  fail(error) {
    if (this.closed) return;
    this.closed = true;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); }
    this.pending.clear(); this.lines?.close(); this.child?.kill(); this.onExit(error);
  }
  close() {
    if (this.closed) return;
    this.fail(new Error('Codex connection closed'));
  }
}
