/**
 * Deliberately small, durable publisher for the Gruia Design50 examples.
 * It is a post-review operation: it never creates Design runs or rewrites
 * campaign state/output files.
 */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Api, type RunnerState } from './runner.ts';
import { verifyRemotePublic } from './public-verifier.ts';

type DesignApi = Pick<Api, 'request'>;
type VercelFetch = (input: string, init?: RequestInit) => Promise<Response>;
export type PublicCheck = { status: number; body: string };
export type VerifyPublic = (url: string, expectedBrand: string, sha256: string) => Promise<PublicCheck>;

interface Qa { ok?: unknown; localHTMLSHA256?: unknown; expectedBrand?: unknown; }
interface ManifestItem { id?: unknown; name?: unknown; }
interface NativeDeployment { id?: unknown; projectId?: unknown; deploymentId?: unknown; url?: unknown; status?: unknown; updatedAt?: unknown; createdAt?: unknown; providerId?: unknown; fileName?: unknown; target?: unknown; }
type VerifiedNative = NativeDeployment & {id: string; projectId: string; deploymentId: string; url: string; status: string};
export interface Publication {
  jobId: string;
  stage: 'pending' | 'published' | 'failed' | 'deferred';
  projectId: string;
  deploymentId?: string;
  nativeDeploymentId?: string;
  url?: string;
  sha256: string;
  attemptAt?: string;
  publishedAt?: string;
  error?: string;
}
export interface PublicationLedger { publications: Record<string, Publication>; }
export interface PublisherOptions {
  stateDir: string;
  api: DesignApi;
  vercelFetch: VercelFetch;
  verifyPublic: VerifyPublic;
  now?: () => number;
  probePid?: (pid: number) => void;
}
export interface PublisherSummary { eligible: number; published: number; deferred: number; failed: number; skipped: number; }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERCEL = 'https://api.vercel.com';

function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function at(now: () => number) { return new Date(now()).toISOString(); }
function briefError(error: unknown) {
  // Never persist a provider response or a bearer token in the durable ledger.
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : 'publisher operation failed';
  if (/^public URL /i.test(text) || /^Vercel deployment does not belong/i.test(text) || /^Vercel request failed \(\d+\)$/.test(text)) return text;
  return 'publication attempt failed';
}
async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(file, 'utf8')) as T; }
  catch (error: any) { if (error?.code === 'ENOENT') return fallback; throw error; }
}
const writes = new Map<string, Promise<void>>();
async function atomic(file: string, value: unknown) {
  const snapshot = JSON.stringify(value, null, 2);
  const next = (writes.get(file) ?? Promise.resolve()).catch(() => undefined).then(() => atomicWrite(file, snapshot));
  writes.set(file, next);
  try { await next; } finally { if (writes.get(file) === next) writes.delete(file); }
}
async function atomicWrite(file: string, snapshot: string) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, snapshot + '\n', { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, file);
}
async function acquireLock(dir: string, probe: (pid: number) => void) {
  const file = join(dir, 'publisher.lock');
  try {
    const handle = await open(file, 'wx', 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
    await handle.close();
  } catch (error: any) {
    if (error?.code !== 'EEXIST') throw error;
    const old = await readJson<{pid?: unknown}>(file, {});
    if (!Number.isInteger(old.pid) || (old.pid as number) <= 0) throw new Error('publisher lock is invalid; refusing to remove it');
    try { probe(old.pid as number); throw new Error('another publisher instance is active'); }
    catch (probeError: any) {
      if (probeError?.message === 'another publisher instance is active' || probeError?.code === 'EPERM') throw new Error('another publisher instance is active');
      if (probeError?.code !== 'ESRCH') throw probeError;
    }
    await unlink(file);
    return acquireLock(dir, probe);
  }
  return async () => { await unlink(file).catch(() => undefined); };
}
function rawContent(value: any): string { return typeof value === 'string' ? value : typeof value?.content === 'string' ? value.content : typeof value?.text === 'string' ? value.text : ''; }
function validNative(value: any, projectId: string): value is VerifiedNative {
  // The Design project identifier is the security boundary and must be a UUID.
  // Native and Vercel deployment identifiers are provider-owned opaque strings.
  return value && typeof value.id === 'string' && value.id.length > 0 && UUID.test(projectId) && value.projectId === projectId && typeof value.deploymentId === 'string' && value.deploymentId.length > 0 && typeof value.url === 'string' && /^https:\/\//.test(value.url) && typeof value.status === 'string';
}
function historyMatch(value: NativeDeployment, projectId: string, after: number): value is VerifiedNative {
  const timestamp = value.updatedAt ?? value.createdAt;
  const changed = typeof timestamp === 'number' ? timestamp : Date.parse(String(timestamp ?? ''));
  return validNative(value, projectId) && Number.isFinite(changed) && changed >= after && value.providerId === 'vercel-self' && value.fileName === 'index.html';
}
async function nativeHistory(api: DesignApi, projectId: string) {
  const result = await api.request(`/api/projects/${encodeURIComponent(projectId)}/deployments`);
  return Array.isArray(result?.deployments) ? result.deployments as NativeDeployment[] : [];
}
async function vercelJson(fetcher: VercelFetch, path: string, init?: RequestInit) {
  const response = await fetcher(`${VERCEL}${path}`, init);
  if (!response.ok) throw new Error(`Vercel request failed (${response.status})`);
  try { return await response.json(); } catch { throw new Error('Vercel returned invalid JSON'); }
}
function projectName(project: any) { return typeof project?.name === 'string' ? project.name : typeof project?.project?.name === 'string' ? project.project.name : ''; }
async function makePublic(fetcher: VercelFetch, teamId: string, native: {deploymentId: string}, expected: string) {
  const deployment = await vercelJson(fetcher, `/v13/deployments/${encodeURIComponent(native.deploymentId)}?teamId=${encodeURIComponent(teamId)}`);
  const vercelProjectId = deployment?.projectId;
  if (typeof vercelProjectId !== 'string' || !vercelProjectId) throw new Error('Vercel deployment has no project identifier');
  const project = await vercelJson(fetcher, `/v9/projects/${encodeURIComponent(vercelProjectId)}?teamId=${encodeURIComponent(teamId)}`);
  if (projectName(project) !== expected) throw new Error('Vercel deployment does not belong to the expected example project');
  await vercelJson(fetcher, `/v9/projects/${encodeURIComponent(vercelProjectId)}?teamId=${encodeURIComponent(teamId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ssoProtection: null }) });
}
async function verify(check: VerifyPublic, url: string, brand: string, digest: string) {
  const result = await check(url, brand, digest);
  const body = typeof result?.body === 'string' ? result.body : '';
  if (result?.status !== 200 || !body.trim()) throw new Error('public URL did not return non-empty HTML');
  const lower = body.toLowerCase();
  if (!lower.includes(brand.toLowerCase())) throw new Error('public URL does not contain the expected example brand');
  if (/authentication required|vercelsecuritycheckpoint|security checkpoint/i.test(body)) throw new Error('public URL is protected by an authentication checkpoint');
  if (sha256(body) !== digest) throw new Error('public URL content differs from the approved local HTML');
}
async function localEligibility(dir: string, job: { id: string; projectId: string; status: string }) {
  if (job.status !== 'succeeded' || !UUID.test(job.projectId)) return undefined;
  const output = join(dir, 'outputs', job.id);
  const qa = await readJson<Qa>(join(output, 'qa.json'), {});
  if (qa.ok !== true || typeof qa.localHTMLSHA256 !== 'string' || !/^[a-f0-9]{64}$/i.test(qa.localHTMLSHA256)) return undefined;
  const html = await readFile(join(output, 'index.html'), 'utf8').catch(() => '');
  if (!html || sha256(html) !== qa.localHTMLSHA256) return undefined;
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  return { sha256: qa.localHTMLSHA256.toLowerCase(), brand: typeof qa.expectedBrand === 'string' && qa.expectedBrand.trim() ? qa.expectedBrand : title || undefined };
}
async function adopt02(dir: string, ledger: PublicationLedger) {
  if (ledger.publications['02']) return;
  const old = await readJson<any>(join(dir, 'published-02.json'), null);
  if (!old || typeof old !== 'object') return;
  const projectId = typeof old.projectId === 'string' ? old.projectId : typeof old.designProjectId === 'string' ? old.designProjectId : typeof old.project?.id === 'string' ? old.project.id : '';
  const deploymentId = typeof old.deploymentId === 'string' ? old.deploymentId : undefined;
  const url = typeof old.url === 'string' ? old.url : typeof old.deploymentUrl === 'string' ? old.deploymentUrl : undefined;
  if (UUID.test(projectId) && deploymentId && url) ledger.publications['02'] = { jobId: '02', projectId, nativeDeploymentId: typeof old.id === 'string' ? old.id : undefined, deploymentId, url, sha256: typeof old.sha256 === 'string' ? old.sha256 : typeof old.localHTMLSHA256 === 'string' ? old.localHTMLSHA256 : '', stage: 'pending', attemptAt: old.publishedAt ?? old.at };
}

/** One bounded pass. Concurrent work is capped at two and never loops/retries itself. */
export async function main(options: PublisherOptions): Promise<PublisherSummary> {
  const now = options.now ?? Date.now;
  const dir = resolve(options.stateDir);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const release = await acquireLock(dir, options.probePid ?? (pid => process.kill(pid, 0)));
  try {
    const state = await readJson<RunnerState>(join(dir, 'state.json'), { jobs: {} });
    const manifest = await readJson<ManifestItem[]>(join(dir, 'manifest.json'), []);
    const names = new Map(manifest.filter((x): x is {id: string; name: string} => typeof x?.id === 'string' && typeof x?.name === 'string').map(x => [x.id, x.name]));
    const ledger = await readJson<PublicationLedger>(join(dir, 'publications.json'), { publications: {} });
    if (!ledger.publications || typeof ledger.publications !== 'object') throw new Error('publications.json is invalid');
    await adopt02(dir, ledger);
    const connection = await readJson<{teamId?: unknown}>(join(dir, 'vercel-connection.json'), {});
    if (typeof connection.teamId !== 'string' || !connection.teamId) throw new Error('vercel-connection.json must contain teamId');
    const teamId = connection.teamId;
    const jobs = Object.values(state.jobs ?? {}).filter((job: any): job is {id: string; projectId: string; status: string} => job && /^\d{2}$/.test(job.id) && typeof job.projectId === 'string' && typeof job.status === 'string');
    const summary: PublisherSummary = { eligible: 0, published: 0, deferred: 0, failed: 0, skipped: 0 };
    const publish = async (job: {id: string; projectId: string; status: string}) => {
      const eligible = await localEligibility(dir, job);
      if (!eligible) { summary.skipped++; return; }
      const brand = eligible.brand ?? names.get(job.id);
      if (!brand) { summary.skipped++; return; }
      summary.eligible++;
      const existing = ledger.publications[job.id];
      if (existing?.sha256 && existing.sha256 !== eligible.sha256) { summary.deferred++; return; }
      if (existing?.stage === 'published' && existing.projectId === job.projectId && existing.sha256 === eligible.sha256 && existing.url) { summary.skipped++; return; }
      const current = rawContent(await options.api.request(`/api/projects/${encodeURIComponent(job.projectId)}/raw/index.html`));
      if (!current || sha256(current) !== eligible.sha256) {
        ledger.publications[job.id] = { ...(existing ?? { jobId: job.id, projectId: job.projectId }), stage: 'deferred', projectId: job.projectId, sha256: eligible.sha256, error: 'current Design HTML differs from QA-approved local HTML; re-QA required' };
        await atomic(join(dir, 'publications.json'), ledger); summary.deferred++; return;
      }
      // A durable published record is still checked without auth before it is reused.
      if (existing?.stage === 'published' && existing.sha256 === eligible.sha256 && existing.url) {
        try { await verify(options.verifyPublic, existing.url, brand, eligible.sha256); summary.skipped++; }
        catch (error) {
          ledger.publications[job.id] = { ...existing, stage: 'failed', error: briefError(error) };
          await atomic(join(dir, 'publications.json'), ledger); summary.failed++;
        }
        return;
      }
      let native: VerifiedNative | undefined;
      try {
        // An adopted record has a known deployment URL. Verify/reuse it: never republish #02.
        if (existing?.deploymentId && existing.url && existing.projectId === job.projectId) native = { id: existing.nativeDeploymentId ?? `adopted-${existing.deploymentId}`, projectId: job.projectId, deploymentId: existing.deploymentId, url: existing.url, status: 'ready' };
        if (!native && existing?.stage === 'pending' && existing.attemptAt) {
          native = (await nativeHistory(options.api, job.projectId)).find(x => historyMatch(x, job.projectId, Date.parse(existing.attemptAt!)));
          // A pending record means the prior POST may have reached Design/Vercel.
          // Never turn an unknown outcome into a duplicate deploy.
          if (!native) {
            ledger.publications[job.id] = { ...existing, error: 'native deployment outcome is unknown; recovery required' };
            await atomic(join(dir, 'publications.json'), ledger); summary.deferred++; return;
          }
        }
        if (!native) {
          const attemptAt = at(now);
          ledger.publications[job.id] = { jobId: job.id, projectId: job.projectId, stage: 'pending', sha256: eligible.sha256, attemptAt };
          await atomic(join(dir, 'publications.json'), ledger);
          try {
            const made = await options.api.request(`/api/projects/${encodeURIComponent(job.projectId)}/deploy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId: 'vercel-self', fileName: 'index.html', target: 'preview' }), signal: AbortSignal.timeout(240_000) });
            if (!validNative(made?.deployment ?? made, job.projectId)) throw new Error('native deployment response was invalid');
            native = made.deployment ?? made;
          } catch (error) {
            native = (await nativeHistory(options.api, job.projectId)).find(x => historyMatch(x, job.projectId, Date.parse(attemptAt)));
            if (!native) {
              ledger.publications[job.id] = { jobId: job.id, projectId: job.projectId, stage: 'pending', sha256: eligible.sha256, attemptAt, error: 'native deployment outcome is unknown; recovery required' };
              await atomic(join(dir, 'publications.json'), ledger); summary.deferred++; return;
            }
          }
        }
        // Persist the known provider identity before any later provider/public check.
        // A rerun can then reuse this deployment after a later transport failure.
        ledger.publications[job.id] = {
          ...(ledger.publications[job.id] ?? { jobId: job.id, projectId: job.projectId, sha256: eligible.sha256 }),
          stage: 'pending', nativeDeploymentId: native.id, deploymentId: native.deploymentId, url: native.url,
        };
        await atomic(join(dir, 'publications.json'), ledger);
        const verified = native;
        if (!verified) throw new Error('native deployment response was invalid');
        await makePublic(options.vercelFetch, teamId, verified, `od-${job.projectId}`);
        await verify(options.verifyPublic, verified.url, brand, eligible.sha256);
        ledger.publications[job.id] = { jobId: job.id, projectId: job.projectId, stage: 'published', nativeDeploymentId: verified.id, deploymentId: verified.deploymentId, url: verified.url, sha256: eligible.sha256, attemptAt: ledger.publications[job.id]?.attemptAt, publishedAt: at(now) };
        await atomic(join(dir, 'publications.json'), ledger); summary.published++;
      } catch (error) {
        const pending = ledger.publications[job.id];
        ledger.publications[job.id] = { ...(pending ?? { jobId: job.id, projectId: job.projectId, sha256: eligible.sha256 }), stage: 'failed', error: briefError(error) };
        await atomic(join(dir, 'publications.json'), ledger); summary.failed++;
      }
    };
    // Exactly one bounded pass; this publisher never creates Design/model runs.
    for (let i = 0; i < jobs.length; i += 2) await Promise.all(jobs.slice(i, i + 2).map(job => publish(job).catch(async () => {
      const old = ledger.publications[job.id];
      if (old) ledger.publications[job.id] = { ...old, error: 'publication transport failed; retry verification' };
      await atomic(join(dir, 'publications.json'), ledger); summary.failed++;
    })));
    return summary;
  } finally { await release(); }
}

async function production() {
  const stateDir = process.env.GRUIA_B2B50_STATE ?? join(homedir(), '.local/state/gruia-design-b2b50');
  const state = await readJson<RunnerState>(join(stateDir, 'state.json'), {jobs:{}});
  const ledger = await readJson<PublicationLedger>(join(stateDir, 'publications.json'), {publications:{}});
  if (!Object.values(state.jobs).some(job => job.status === 'succeeded' && ledger.publications[job.id]?.stage !== 'published')) return;
  // This is intentionally in the parent CLI only. Tests/workers inject both clients.
  execFileSync(process.env.GRUIA_VERCEL_BIN ?? 'vercel', ['whoami'], { stdio: 'ignore', timeout: 60_000 });
  const auth = await readJson<{token?: unknown}>(join(homedir(), '.local/share/com.vercel.cli/auth.json'), {});
  if (typeof auth.token !== 'string' || !auth.token) throw new Error('Vercel CLI access token missing');
  const credentials = await readJson<{email?: unknown; password?: unknown}>(join(stateDir, 'credentials.json'), {});
  if (typeof credentials.email !== 'string' || !credentials.email || typeof credentials.password !== 'string' || !credentials.password) throw new Error('campaign credentials are invalid');
  const session = await readJson(join(stateDir, 'browser-session.json'), {});
  const api = new Api(stateDir, { email: credentials.email, password: credentials.password }, session, globalThis.fetch);
  const vercelFetch: VercelFetch = (url, init) => globalThis.fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(30_000), headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${auth.token}` } });
  // The actual unauthenticated remote probe is deliberately supplied by the parent operation.
  const verifyPublic: VerifyPublic = verifyRemotePublic;
  console.log(JSON.stringify(await main({ stateDir, api, vercelFetch, verifyPublic })));
}

if (import.meta.url === `file://${resolve(process.argv[1] ?? '')}`) production().catch(error => { console.error(briefError(error)); process.exitCode = 1; });
