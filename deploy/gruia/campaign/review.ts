import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
const root = process.env.GRUIA_B2B50_STATE ?? join(homedir(), '.local/state/gruia-design-b2b50');
const read = (name: string) => existsSync(join(root, name)) ? JSON.parse(readFileSync(join(root, name), 'utf8')) : null;
const state = read('state.json');
const raw = state?.jobs ?? state?.items ?? [];
const jobs: any[] = Array.isArray(raw) ? raw : Object.values(raw);
const counts: Record<string, number> = {};
for (const job of jobs) counts[job.status ?? 'unknown'] = (counts[job.status ?? 'unknown'] ?? 0) + 1;
const active = spawnSync('systemctl', ['--user', 'is-active', 'gruia-design-b2b50.service'], { encoding: 'utf8' }).stdout.trim();
const result = { at: new Date().toISOString(), counts, active, pauseUntil: state?.pauseUntil ?? null, gateApproved: read('gate.json')?.approved === true };
appendFileSync(join(root, 'reviews.jsonl'), JSON.stringify(result) + '\n', { mode: 0o600 });
console.log(JSON.stringify(result));
const complete = jobs.length >= 50 && jobs.every(job => ['complete', 'completed', 'succeeded', 'generated'].includes(job.status));
if (result.gateApproved && !complete && !['active', 'activating'].includes(active) && existsSync(join(root, 'runner.ts')) && existsSync(join(root, 'manifest.json'))) {
  const start = spawnSync('systemctl', ['--user', 'start', 'gruia-design-b2b50.service'], { encoding: 'utf8' });
  if (start.status !== 0) throw new Error('The campaign could not resume; inspect the service journal.');
  console.log('Campaign resumed.');
}
