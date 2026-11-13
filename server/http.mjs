import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LeadPilot } from './pilot.mjs';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
export function createBridge({ pilot, root, port = 8787 }) {
  const token = randomBytes(32).toString('hex');
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'");
    const reply = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
    // Host validation prevents DNS rebinding; exact-origin checks plus an unpredictable per-process nonce prevent CSRF.
    const host = request.headers.host;
    if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) { reply(403, { error: 'Loopback host required' }); return; }
    if (request.headers.origin && request.headers.origin !== `http://${host}`) { reply(403, { error: 'Origin rejected' }); return; }
    const path = new URL(request.url, `http://${host}`).pathname;
    if (request.method === 'GET' && path === '/api/codex/session') { reply(200, { token }); return; }
    if (request.method === 'GET' && path === '/api/codex/snapshot') { reply(200, pilot.snapshot()); return; }
    if (request.method === 'POST' && path === '/api/codex/action') {
      const provided = Buffer.from(String(request.headers['x-ai-office-token'] || ''));
      if (provided.length !== token.length || !timingSafeEqual(provided, Buffer.from(token))) { reply(403, { error: 'Invalid session' }); return; }
      if (request.headers['content-type'] !== 'application/json') { reply(415, { error: 'JSON required' }); return; }
      try {
        let body = ''; for await (const chunk of request) { body += chunk; if (body.length > 1024) { reply(413, { error: 'Request too large' }); return; } }
        const data = JSON.parse(body);
        const methods = { connect: () => pilot.connect(), start: () => pilot.start(), interrupt: () => pilot.interrupt(), reject: () => pilot.rejectApproval(), disconnect: () => pilot.disconnect() };
        if (!data || typeof data !== 'object' || Object.keys(data).length !== 1 || !Object.hasOwn(methods, data.action)) { reply(400, { error: 'Invalid pilot action' }); return; }
        await methods[data.action](); reply(200, pilot.snapshot());
      } catch { reply(409, { error: 'Pilot action failed; inspect connection status', snapshot: pilot.snapshot() }); }
      return;
    }
    if (request.method !== 'GET' || path.startsWith('/api/')) { reply(404, { error: 'Not found' }); return; }
    try {
      const dist = resolve(root, 'dist'), file = resolve(dist, '.' + (path === '/' ? '/index.html' : decodeURIComponent(path)));
      const rel = relative(dist, file);
      if (rel.startsWith('..') || !types[extname(file)] || !statSync(file).isFile()) throw new Error();
      response.writeHead(200, { 'Content-Type': types[extname(file)] }); response.end(readFileSync(file));
    } catch { reply(404, { error: 'Build the office first, or use the Vite development server' }); }
  });
  server.requestTimeout = 30000; server.headersTimeout = 10000;
  return { server, listen: () => new Promise(resolve => server.listen(port, '127.0.0.1', resolve)),
    close: () => { pilot.disconnect(); server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const bridge = createBridge({ root, pilot: new LeadPilot({ root }) });
  await bridge.listen(); console.log('AI Office bridge: http://127.0.0.1:8787 (mock default; Lead read-only pilot on request)');
  const stop = () => bridge.close().then(() => process.exit());
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
