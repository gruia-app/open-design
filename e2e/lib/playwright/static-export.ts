// Serves `apps/web/out` through a plain static file server — the same artifact
// Vercel publishes — for specs that must prove the daemon-less standalone
// surface. Mirrors vercel.json's SPA fallback: any path that does not resolve
// to a real file under out/ is answered with index.html.

import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
export const OUT_DIR = join(REPO_ROOT, 'apps', 'web', 'out');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

export function serveStaticExport(root: string): Promise<Server> {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://static.test').pathname);
    let file = normalize(join(root, pathname));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file) || !statSync(file).isFile()) file = join(root, 'index.html');
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => resolvePromise(server));
  });
}

/** Builds `out/` when missing and serves it; returns the base URL. Call from
 *  `beforeAll`, close the returned server in `afterAll`. */
export async function serveCharactersStaticExport(): Promise<{
  server: Server;
  baseUrl: string;
}> {
  if (!existsSync(join(OUT_DIR, 'index.html'))) {
    execFileSync('pnpm', ['--filter', '@open-design/web', 'build'], {
      cwd: REPO_ROOT,
      env: { ...process.env, OD_WEB_OUTPUT_MODE: '' },
      stdio: 'pipe',
    });
  }
  const server = await serveStaticExport(OUT_DIR);
  const address = server.address();
  if (address == null || typeof address === 'string') {
    throw new Error('static server has no port');
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}
