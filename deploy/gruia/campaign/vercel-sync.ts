import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Api } from './runner.ts';

// Refresh through the existing CLI account; its refresh credential stays local.
// Only the current access token is sent to Design's protected configuration API.
const dir = process.env.GRUIA_B2B50_STATE ?? join(homedir(), '.local/state/gruia-design-b2b50');
const read = async (name: string) => JSON.parse(await readFile(join(dir, name), 'utf8'));
try {
  const refreshed = spawnSync(process.env.GRUIA_VERCEL_BIN ?? 'vercel', ['whoami'], { encoding: 'utf8', timeout: 60_000 });
  if (refreshed.status !== 0) throw new Error('Vercel CLI session could not refresh');
  const auth = JSON.parse(await readFile(join(homedir(), '.local/share/com.vercel.cli/auth.json'), 'utf8'));
  if (typeof auth.token !== 'string' || !auth.token) throw new Error('Vercel CLI access token missing');
  const connection = await read('vercel-connection.json');
  if (!connection.teamId || !connection.teamSlug) throw new Error('Vercel connection metadata missing');
  const api = new Api(dir, await read('credentials.json'), await read('browser-session.json'), fetch);
  const current = await api.request('/api/deploy/config?providerId=vercel-self');
  if (!current.configured || current.teamId !== connection.teamId) throw new Error('Vercel connection changed; refusing to overwrite it');
  await api.request('/api/deploy/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId: 'vercel-self', token: auth.token, teamId: connection.teamId, teamSlug: connection.teamSlug }) });
  await writeFile(join(dir, 'vercel-sync-status.json'), JSON.stringify({ ok: true, at: new Date().toISOString(), expiresAt: auth.expiresAt, teamSlug: connection.teamSlug }), { mode: 0o600 });
  console.log('Vercel connection refreshed.');
} catch (error) {
  // Never include provider response bodies, tokens, or CLI output in this log.
  const message = error instanceof Error ? error.message : 'Vercel sync failed';
  console.error(message.startsWith('HTTP ') ? 'Design API unavailable during Vercel sync' : message);
  process.exitCode = 1;
}
