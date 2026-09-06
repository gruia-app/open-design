import { mkdir, readFile, writeFile, rename, chmod, unlink, open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type Model = 'claude-fable-5-1' | 'claude-opus-5';
export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'paused' | 'needs_attention';
export type AttemptPhase = 'none' | 'prepared' | 'active';
export interface ManifestJob { id: string; name: string; sector: string; style: string; layout: string; interaction: string; designSystemId: string | null; model: Model; inspirations: string[]; prompt: string; }
export interface JobState { id: string; projectId: string; conversationId?: string; clientRequestId?: string; userMessageId?: string; assistantMessageId?: string; runId?: string; attempts?: number; normalFailures: number; attemptPhase: AttemptPhase; status: JobStatus; error?: string; qaIssues?: string[]; pilotPrompt?: string; createdAt?: string; updatedAt: string; completedAt?: string; }
export interface RunnerState { jobs: Record<string, JobState>; pauseUntil?: string; stopQueue?: boolean; }
export interface QaResult { ok: boolean; issues: string[]; infrastructure?: boolean; }
export type PrototypeQa = (stateDir: string, id: string, projectId: string) => Promise<QaResult>;
export interface RunnerOptions { concurrency?: number; fableConcurrency?: number; opusConcurrency?: number; prototypeQa?: PrototypeQa; stateDir?: string; fetch?: typeof fetch; now?: () => number; probePid?: (pid: number) => void; log?: (line: string) => void; }

const ORIGIN = 'https://design.gruia.app', API = `${ORIGIN}/api`, MAX_SSE_MS = 20 * 60 * 1000, REQUEST_TIMEOUT_MS = 30_000;
const MODELS: readonly Model[] = ['claude-fable-5-1', 'claude-opus-5'];
const writeChains = new Map<string, Promise<void>>();
export function classifyQuotaError(error: unknown): boolean { if ((error as any)?.status === 429) return true; return /(rate[_ -]?limit|quota|usage\s*limit|you['’]?ve (?:hit|reached) your (?:\w+ )?limit|resets?\b)/i.test(error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error ?? '')); }
export function isDeliveredHtml(html: unknown): html is string { if (typeof html !== 'string' || html.length <= 6000) return false; const s = html.toLowerCase(); return /<html\b|<body\b/.test(s) && /<style\b|<script\b/.test(s) && /<main\b|<button\b|<input\b|<select\b|<nav\b/.test(s); }
export function seedJobState(state: RunnerState, job: ManifestJob, projectId = randomUUID(), now = new Date().toISOString()): RunnerState { if (!state.jobs[job.id]) state.jobs[job.id] = { id: job.id, projectId, normalFailures: 0, attemptPhase: 'none', status: 'pending', createdAt: now, updatedAt: now }; return state; }
function msg(e: unknown) { return e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e); }
function summary(e: unknown) { return msg(e).replace(/[\r\n]+/g, ' ').slice(0, 500); }
function attention(e: unknown) { const status = (e as any)?.status; if (status === 429 || status >= 500) return false; return /(authentication|csrf|login|unauthori[sz]ed|model.*unavailable|unavailable.*model)/i.test(msg(e)); }
function httpError(status: number, message: string): Error & {status: number} { return Object.assign(new Error(`HTTP ${status}: ${message}`), { status }); }
function iso(now: () => number) { return new Date(now()).toISOString(); }
async function json<T>(file: string, fallback: T): Promise<T> { try { return JSON.parse(await readFile(file, 'utf8')) as T; } catch (error: any) { if (error?.code === 'ENOENT') return fallback; throw error; } }
async function atomicNow(file: string, value: unknown, mode: number) { await mkdir(dirname(file), { recursive: true, mode: 0o700 }); const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { mode }); await chmod(tmp, mode); await rename(tmp, file); }
/** Serialize a target's whole write/rename operation: old snapshots cannot win later. */
async function atomic(file: string, value: unknown, mode = 0o600) { const old = writeChains.get(file) ?? Promise.resolve(); const next = old.catch(() => undefined).then(() => atomicNow(file, value, mode)); writeChains.set(file, next); try { await next; } finally { if (writeChains.get(file) === next) writeChains.delete(file); } }
function index(manifest: ManifestJob[], state: RunnerState) { return manifest.map(j => ({ id: j.id, name: j.name, model: j.model, status: state.jobs[j.id].status, projectURL: `${ORIGIN}/projects/${state.jobs[j.id].projectId}` })); }
async function persist(dir: string, manifest: ManifestJob[], state: RunnerState) { await atomic(join(dir, 'state.json'), state); await atomic(join(dir, 'index.json'), index(manifest, state)); }

export function validateManifest(value: unknown): ManifestJob[] {
  if (!Array.isArray(value) || value.length !== 63) throw new Error('manifest must contain exactly 63 jobs');
  const ids = new Set<string>();
  for (const x of value) { const j = x as ManifestJob; if (!j || typeof j !== 'object' || !/^\d{2}$/.test(j.id) || ids.has(j.id)) throw new Error('manifest IDs must be unique two-digit values'); ids.add(j.id);
    if (typeof j.name !== 'string' || !j.name || typeof j.sector !== 'string' || !j.sector || typeof j.style !== 'string' || !j.style || typeof j.layout !== 'string' || !j.layout || typeof j.interaction !== 'string' || !j.interaction || typeof j.prompt !== 'string' || !j.prompt || (j.designSystemId !== null && (typeof j.designSystemId !== 'string' || !j.designSystemId)) || !MODELS.includes(j.model) || !Array.isArray(j.inspirations) || !j.inspirations.every(v => typeof v === 'string')) throw new Error(`manifest job ${j.id} has invalid fields`);
  }
  for (let n = 1; n <= 63; n++) if (!ids.has(String(n).padStart(2, '0'))) throw new Error('manifest IDs must be 01 through 63');
  return value as ManifestJob[];
}
function normalize(state: RunnerState) { if (!state || typeof state !== 'object' || !state.jobs || typeof state.jobs !== 'object' || Array.isArray(state.jobs)) throw new Error('state.json contains invalid jobs'); for (const [id, value] of Object.entries(state.jobs)) { if (!/^\d{2}$/.test(id) || !value || value.id !== id || typeof value.projectId !== 'string' || !value.projectId || !['pending', 'running', 'succeeded', 'failed', 'paused', 'needs_attention'].includes(value.status)) throw new Error('state.json contains invalid job ' + id); } for (const s of Object.values(state.jobs)) { s.normalFailures ??= s.attempts ?? 0; s.attemptPhase ??= s.runId ? 'active' : s.clientRequestId ? 'prepared' : 'none'; } }

export class Api {
  cookies = new Map<string, string>(); private loginPromise?: Promise<void>; private origins: unknown[]; private dir: string; private creds: { email: string; password: string }; private fetcher: typeof fetch;
  constructor(dir: string, creds: { email: string; password: string }, session: any, fetcher: typeof fetch) { this.dir = dir; this.creds = creds; this.fetcher = fetcher; this.origins = Array.isArray(session?.origins) ? session.origins : []; for (const c of session?.cookies ?? []) if (c?.name && c?.value && c.domain === 'design.gruia.app') this.cookies.set(c.name, c.value); }
  private header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '); }
  private capture(h: Headers) { const lines: string[] = typeof (h as any).getSetCookie === 'function' ? (h as any).getSetCookie() : []; for (const line of lines) { const p = line.split(';', 1)[0], i = p.indexOf('='); if (i > 0) this.cookies.set(p.slice(0, i).trim(), p.slice(i + 1).trim()); } return lines; }
  private fetch(url: string, init: RequestInit = {}) { return this.fetcher(url, { ...init, signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: 'manual' }); }
  private async auth() {
    if (this.loginPromise) return this.loginPromise;
    const attempt = (async () => { const page = await this.fetch(`${ORIGIN}/auth/login`, { headers: { Origin: ORIGIN, Referer: `${ORIGIN}/auth/login` } }); this.capture(page.headers); if (!page.ok) throw httpError(page.status, page.status === 429 || page.status >= 500 ? 'temporary upstream failure' : 'authentication login page rejected'); const m = (await page.text()).match(/<input[^>]+name="csrf"[^>]+value="([^"]+)"/i); if (!m) throw new Error('authentication failed: csrf token missing');
      const body = new URLSearchParams({ email: this.creds.email, password: this.creds.password, csrf: m[1] }); const before = new Map(this.cookies); const res = await this.fetch(`${ORIGIN}/auth/login`, { method: 'POST', headers: { Origin: ORIGIN, Referer: `${ORIGIN}/auth/login`, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: this.header() }, body }); const minted = this.capture(res.headers).some(x => { const name = x.split('=', 1)[0].trim(); return /session/i.test(name) && before.get(name) !== this.cookies.get(name); }); if (![302, 303].includes(res.status) || !minted) throw httpError(res.status, res.status === 429 || res.status >= 500 ? 'temporary upstream failure' : 'authentication failed');
      await atomic(join(this.dir, 'browser-session.json'), { cookies: [...this.cookies].map(([name, value]) => ({ name, value, domain: 'design.gruia.app', path: '/', expires: -1, httpOnly: true, secure: true, sameSite: 'Lax' })), origins: this.origins }); })();
    this.loginPromise = attempt; try { await attempt; } finally { this.loginPromise = undefined; }
  }
  async request(path: string, init: RequestInit = {}, retried = false): Promise<any> { const h = new Headers(init.headers); h.set('Origin', ORIGIN); h.set('Referer', ORIGIN); if (this.header()) h.set('Cookie', this.header()); const r = await this.fetch(`${ORIGIN}${path}`, { ...init, headers: h }); this.capture(r.headers); if (r.status === 401 && !retried) { await this.auth(); return this.request(path, init, true); } const text = await r.text(); let data: any; try { data = text ? JSON.parse(text) : undefined; } catch { data = text; } if (!r.ok) { const e = new Error(`HTTP ${r.status}: ${summary(data)}`); (e as any).status = r.status; throw e; } return data; }
  events(runId: string) { return this.fetch(`${API}/runs/${encodeURIComponent(runId)}/events`, { headers: { Origin: ORIGIN, Referer: ORIGIN, Cookie: this.header() }, signal: AbortSignal.timeout(MAX_SSE_MS) }); }
}

export async function acquireRunnerLock(dir: string, review: boolean, probe: (pid: number) => void = pid => process.kill(pid, 0)): Promise<() => Promise<void>> {
  const lock = join(dir, 'runner.lock'); if (review) return async () => {};
  try { const h = await open(lock, 'wx', 0o600); await h.writeFile(JSON.stringify({ pid: process.pid, startedAt: Date.now() })); await h.close(); return async () => { await unlink(lock).catch(() => {}); }; }
  catch (e: any) { if (e?.code !== 'EEXIST') throw e; const old = await json<{ pid?: number }>(lock, {}); if (!old.pid) throw new Error('runner lock is invalid; refusing to remove it'); try { probe(old.pid); throw new Error('another runner instance is active'); } catch (probeError: any) { if (probeError?.message === 'another runner instance is active' || probeError?.code === 'EPERM') throw new Error('another runner instance is active'); if (probeError?.code !== 'ESRCH') throw probeError; } await unlink(lock); return acquireRunnerLock(dir, review, probe); }
}
async function status(api: Api, id: string) { const r = await api.request(`/api/runs/${encodeURIComponent(id)}`); return r?.run ?? r; }
async function wait(api: Api, id: string) { const r = await api.events(id); if (!r.ok || !r.body) throw new Error(`event stream unavailable (${r.status})`); const reader = r.body.getReader(); let buf = ''; const dec = new TextDecoder(); try { for (;;) { const { value, done } = await reader.read(); if (done) throw new Error('event stream disconnected'); buf += dec.decode(value, { stream: true }); const bits = buf.split(/\n\n/); buf = bits.pop() ?? ''; if (bits.some(x => /event:\s*end/.test(x))) return; } } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); } }
async function output(api: Api, dir: string, j: ManifestJob, s: JobState) { const files = await api.request(`/api/projects/${encodeURIComponent(s.projectId)}/files`), names = new Set((files?.files ?? []).map((x: any) => x.name)); if (!['index.html', 'DESIGN.md', 'README.md'].every(x => names.has(x))) return false; const raw = async (name: string) => { const x = await api.request(`/api/projects/${encodeURIComponent(s.projectId)}/raw/${encodeURIComponent(name)}`); return typeof x === 'string' ? x : x?.content ?? x?.text ?? ''; }; const [html, design, readme] = await Promise.all([raw('index.html'), raw('DESIGN.md'), raw('README.md')]); if (!isDeliveredHtml(html) || typeof design !== 'string' || !design.trim() || typeof readme !== 'string' || !readme.trim()) return false; const root = resolve(dir, 'outputs'), out = resolve(root, j.id); if (!out.startsWith(root + '/')) throw new Error('unsafe output path'); await mkdir(out, { recursive: true, mode: 0o700 }); await Promise.all([writeFile(join(out, 'index.html'), html, { mode: 0o600 }), writeFile(join(out, 'DESIGN.md'), design, { mode: 0o600 }), writeFile(join(out, 'README.md'), readme, { mode: 0o600 })]); await atomic(join(out, 'manifest.json'), { id: j.id, name: j.name, model: j.model }); return true; }
function clear(s: JobState) { delete s.runId; delete s.clientRequestId; delete s.userMessageId; delete s.assistantMessageId; s.attemptPhase = 'none'; }
async function recoverConversation(api: Api, s: JobState) { let project: any; try { project = await api.request(`/api/projects/${encodeURIComponent(s.projectId)}`); } catch (e: any) { if (e?.status === 404) return false; throw e; } const x = await api.request(`/api/projects/${encodeURIComponent(s.projectId)}/conversations`); if (!Array.isArray(x?.conversations)) throw new Error('conversation recovery returned an invalid response'); s.conversationId = project?.project?.conversationId ?? project?.conversationId ?? x.conversations[0]?.id; if (!s.conversationId) throw new Error('project recovery found no canonical conversation'); return true; }
async function matched(api: Api, s: JobState) { const x = await api.request(`/api/runs?projectId=${encodeURIComponent(s.projectId)}`); if (!Array.isArray(x?.runs)) throw new Error('run recovery returned an invalid response'); return x.runs.find((r: any) => r.clientRequestId === s.clientRequestId)?.id as string | undefined; }
async function conversation(api: Api, dir: string, m: ManifestJob[], state: RunnerState, j: ManifestJob) { const s = state.jobs[j.id]; if (s.conversationId) return; if (await recoverConversation(api, s)) { await persist(dir, m, state); return; } try { const x = await api.request('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.projectId, name: `B2B ${j.id} · ${j.name} · ${j.sector}`, skillId: null, designSystemId: j.designSystemId, metadata: { kind: 'prototype', nameSource: 'user' } }) }); s.projectId = x.project?.id ?? s.projectId; s.conversationId = x.conversationId ?? x.project?.conversationId; if (!s.conversationId && !(await recoverConversation(api, s))) throw new Error('project creation returned no conversation'); } catch (e) { if (await recoverConversation(api, s)) { await persist(dir, m, state); return; } throw e; } await persist(dir, m, state); }
async function start(api: Api, dir: string, m: ManifestJob[], state: RunnerState, j: ManifestJob, now: () => number) { const s = state.jobs[j.id]; if (!s.clientRequestId) { s.clientRequestId = randomUUID(); s.userMessageId = randomUUID(); s.assistantMessageId = randomUUID(); s.attemptPhase = 'prepared'; s.updatedAt = iso(now); await persist(dir, m, state); } const old = await matched(api, s); if (old) { s.runId = old; s.attemptPhase = 'active'; await persist(dir, m, state); return; } const prompt = s.normalFailures > 0 ? `${s.pilotPrompt ?? j.prompt}\n\nRefine the existing prototype: ensure index.html, DESIGN.md, and README.md are complete and the delivered HTML is substantial and interactive.\nSpecific issues from the last browser review:\n${(s.qaIssues ?? [s.error ?? 'Incomplete output']).map(issue => '- ' + issue).join('\n')}` : s.pilotPrompt ?? j.prompt; await api.request(`/api/projects/${encodeURIComponent(s.projectId)}/conversations/${encodeURIComponent(s.conversationId!)}/messages/${encodeURIComponent(s.userMessageId!)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.userMessageId, role: 'user', content: prompt, createdAt: now(), sessionMode: 'design', createOnly: true }) }); let made: any; try { made = await api.request('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: 'claude', message: `## user\n${prompt}`, currentPrompt: prompt, priorTranscript: '', projectId: s.projectId, conversationId: s.conversationId, sessionMode: 'design', userMessageId: s.userMessageId, assistantMessageId: s.assistantMessageId, clientRequestId: s.clientRequestId, skillId: null, skillIds: [], designSystemId: j.designSystemId, attachments: [], commentAttachments: [], model: j.model, reasoning: null, serviceTier: null, locale: 'es-ES' }) }); } catch (e) { const found = await matched(api, s); if (found) { s.runId = found; s.attemptPhase = 'active'; await persist(dir, m, state); return; } throw e; } if (!made?.runId) throw new Error('run creation returned no runId'); s.runId = made.runId; s.attemptPhase = 'active'; s.updatedAt = iso(now); await persist(dir, m, state); await api.request(`/api/projects/${encodeURIComponent(s.projectId)}/conversations/${encodeURIComponent(s.conversationId!)}/messages/${encodeURIComponent(s.assistantMessageId!)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.assistantMessageId, role: 'assistant', content: '', agentId: 'claude', agentName: `Claude · ${j.model}`, createdAt: now(), runStatus: 'queued', startedAt: now(), sessionMode: 'design', runId: s.runId }) }); }
async function run(api: Api, dir: string, m: ManifestJob[], state: RunnerState, j: ManifestJob, now: () => number, qa?: PrototypeQa): Promise<'progress' | 'defer'> {
  const s = state.jobs[j.id]; if (['succeeded', 'failed', 'needs_attention'].includes(s.status)) return 'progress';
  try {
    await conversation(api, dir, m, state, j); if (!s.runId) await start(api, dir, m, state, j, now);
    s.status = 'running'; s.updatedAt = iso(now); await persist(dir, m, state);
    let r = await status(api, s.runId!);
    if (['queued', 'running'].includes(r?.status)) { try { await wait(api, s.runId!); } catch { r = await status(api, s.runId!); if (['queued', 'running'].includes(r?.status)) return 'defer'; } r = await status(api, s.runId!); }
    if (!['succeeded', 'failed', 'canceled'].includes(r?.status)) return 'defer';
    // A terminal run must leave its identity only after this classification, even when output retrieval itself failed.
    let delivered = false; let deliveryError: unknown;
    if (r.status === 'succeeded') try { delivered = await output(api, dir, j, s); } catch (e) { deliveryError = e; }
    // Delivery/QA transport errors retain the completed run for a later verification pass.
    if (deliveryError) throw deliveryError;
    if (delivered && qa) {
      const checked = await qa(dir, j.id, s.projectId);
      if (!checked || typeof checked.ok !== 'boolean' || !Array.isArray(checked.issues)) throw new Error('Invalid browser QA response');
      if (!checked.ok) {
        if (checked.infrastructure || checked.issues.some(issue => /HTTP\s*(?:[345]\d\d|undefined)|net::|network|timed?\s*out|timeout|connection|browser.*(?:closed|launch|not found)|executable.*(?:missing|exist)|authentication|login/i.test(issue))) throw new Error('Browser QA infrastructure: ' + checked.issues.join('; '));
        delivered = false; s.qaIssues = checked.issues; deliveryError = 'Browser QA: ' + checked.issues.join('; ');
      }
    }
    const failure = r.error ?? r.failureDetail ?? r.failureCategory ?? deliveryError;
    if (r.status === 'succeeded' && delivered) { s.status = 'succeeded'; s.completedAt = iso(now); s.error = undefined; delete s.qaIssues; }
    else if (/reached your Fable limit/i.test(String(failure ?? '')) && process.env.GRUIA_B2B50_FABLE_FALLBACK === 'claude-opus-5') { (j as ManifestJob & {plannedModel?: Model}).plannedModel ??= j.model; j.model = 'claude-opus-5'; s.status = 'pending'; s.error = 'Fable model limit; continuing with explicitly configured Opus 5'; await atomic(join(dir, 'manifest.json'), m); }
    else if (classifyQuotaError(failure)) { state.pauseUntil = new Date(now() + 30 * 60 * 1000).toISOString(); s.status = 'paused'; s.error = summary(failure ?? 'quota'); }
    else if (attention(failure)) { s.status = 'needs_attention'; s.error = summary(failure); state.stopQueue = true; }
    else { s.normalFailures++; s.status = s.normalFailures >= 3 ? 'failed' : 'pending'; s.error = summary(failure ?? 'incomplete output'); }
    clear(s); s.updatedAt = iso(now); await persist(dir, m, state); return 'progress';
  } catch (e) {
    s.error = summary(e); s.updatedAt = iso(now);
    if (classifyQuotaError(e)) { state.pauseUntil = new Date(now() + 30 * 60 * 1000).toISOString(); s.status = 'paused'; }
    else if (attention(e)) { s.status = 'needs_attention'; state.stopQueue = true; }
    else s.status = 'pending';
    await persist(dir, m, state); return 'defer';
  }
}
function adopt(state: RunnerState, pilots: any[]) { for (const p of pilots) if (p?.id && !state.jobs[p.id]) state.jobs[p.id] = { id: p.id, projectId: typeof p.projectId === 'string' && p.projectId ? p.projectId : randomUUID(), conversationId: p.conversationId, runId: p.runId, clientRequestId: p.clientRequestId, userMessageId: p.userMessageId, assistantMessageId: p.assistantMessageId, pilotPrompt: typeof p.prompt === 'string' ? p.prompt : undefined, normalFailures: 0, attemptPhase: p.runId ? 'active' : p.clientRequestId ? 'prepared' : 'none', status: p.runId ? 'running' : 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; }
function creds(x: unknown) { const c = x as any; if (!c || typeof c.email !== 'string' || !c.email || typeof c.password !== 'string' || !c.password) throw new Error('credentials.json must contain non-empty email and password strings'); return { email: c.email, password: c.password }; }
export async function main(argv = process.argv.slice(2), options: RunnerOptions = {}): Promise<number> {
  const dir = options.stateDir ?? process.env.GRUIA_B2B50_STATE ?? join(homedir(), '.local/state/gruia-design-b2b50'), review = argv.includes('--review'), once = argv.includes('--once'), now = options.now ?? Date.now;
  if (review) { const m = validateManifest(await json<unknown>(join(dir, 'manifest.json'), [])), state = await json<RunnerState>(join(dir, 'state.json'), { jobs: {} }); (options.log ?? console.log)(JSON.stringify({ jobs: m.length, pauseUntil: state.pauseUntil, counts: Object.values(state.jobs).reduce((a, j) => ((a[j.status] = (a[j.status] ?? 0) + 1), a), {} as Record<string, number>) })); return 0; }
  if (!(await json<{ approved?: boolean }>(join(dir, 'gate.json'), {})).approved) throw new Error('campaign gate is not approved');
  const m = validateManifest(await json<unknown>(join(dir, 'manifest.json'), [])); await mkdir(dir, { recursive: true, mode: 0o700 }); const release = await acquireRunnerLock(dir, false, options.probePid);
  try { const state = await json<RunnerState>(join(dir, 'state.json'), { jobs: {} }); normalize(state); adopt(state, await Promise.all(['pilot-01.json', 'pilot-02.json'].map(x => json<any>(join(dir, x), null)))); for (const j of m) seedJobState(state, j, undefined, iso(now)); if (state.pauseUntil && Date.parse(state.pauseUntil) > now()) { await persist(dir, m, state); return 0; } if (state.pauseUntil) { delete state.pauseUntil; for (const s of Object.values(state.jobs)) if (s.status === 'paused') s.status = 'pending'; } const qa = options.prototypeQa ?? ((argv.includes('--browser-qa') || process.env.GRUIA_B2B50_BROWSER_QA === '1') ? (await import(pathToFileURL(join(dir, 'browser-qa.ts')).href)).checkPrototype as PrototypeQa : undefined); const api = new Api(dir, creds(await json(join(dir, 'credentials.json'), {})), await json(join(dir, 'browser-session.json'), {}), options.fetch ?? globalThis.fetch); await persist(dir, m, state);
    const concurrency = options.concurrency ?? Number(process.env.GRUIA_B2B50_CONCURRENCY ?? 2);
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('concurrency must be an integer between 1 and 8');
    const modelLimits: Record<Model, number> = {
      'claude-fable-5-1': options.fableConcurrency ?? Number(process.env.GRUIA_B2B50_FABLE_CONCURRENCY ?? Math.ceil(concurrency / 2)),
      'claude-opus-5': options.opusConcurrency ?? Number(process.env.GRUIA_B2B50_OPUS_CONCURRENCY ?? Math.ceil(concurrency / 2)),
    };
    if (Object.values(modelLimits).some(limit => !Number.isInteger(limit) || limit < 1 || limit > concurrency)) throw new Error('model concurrency must be an integer between 1 and total concurrency');
    const inFlight = new Map<string, Promise<{id: string; disposition: 'progress' | 'defer'}>>();
    let deferPass = false, dispatched = 0;
    const waiting = (j: ManifestJob) => ['pending', 'running'].includes(state.jobs[j.id].status);
    try {
      for (;;) {
        while (!deferPass && !state.stopQueue && !(state.pauseUntil && Date.parse(state.pauseUntil) > now()) && inFlight.size < concurrency && (!once || dispatched < concurrency)) {
          // Existing run identities reserve capacity even before their observer is scheduled.
          // This matters when adopting more live pilots than the configured ceiling.
          const reserved = m.filter(j => (waiting(j) && Boolean(state.jobs[j.id].runId)) || inFlight.has(j.id));
          const candidates = m.filter(j => waiting(j) && !inFlight.has(j.id)).sort((a,b) => Number(Boolean(state.jobs[b.id].runId)) - Number(Boolean(state.jobs[a.id].runId)));
          const next = candidates.find(j => {
            if (m.filter(other => other.model === j.model && inFlight.has(other.id)).length >= modelLimits[j.model]) return false;
            return Boolean(state.jobs[j.id].runId) || (reserved.length < concurrency && reserved.filter(other => other.model === j.model).length < modelLimits[j.model]);
          });
          if (!next) break;
          dispatched++;
          inFlight.set(next.id, run(api, dir, m, state, next, now, qa).then(disposition => ({id: next.id, disposition})));
        }
        if (!inFlight.size) break;
        const finished = await Promise.race(inFlight.values());
        inFlight.delete(finished.id);
        if (once || finished.disposition === 'defer') deferPass = true;
      }
    } finally { await Promise.allSettled(inFlight.values()); }
    await persist(dir, m, state); return 0;
  } finally { await release(); }
}
if (import.meta.url === `file://${resolve(process.argv[1] ?? '')}`) main().catch(e => { console.error(summary(e)); process.exitCode = 1; });
