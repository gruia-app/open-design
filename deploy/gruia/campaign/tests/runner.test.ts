import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyQuotaError, isDeliveredHtml, main, type ManifestJob, type RunnerState } from '../runner.ts';

const job = (n: number): ManifestJob => ({ id: String(n).padStart(2, '0'), name: `Job ${n}`, sector: 'SaaS', style: 'clean', layout: 'dashboard', interaction: 'filters', designSystemId: null, model: n % 2 ? 'claude-fable-5-1' : 'claude-opus-5', inspirations: [], prompt: `build ${n}` });
const manifest = () => Array.from({ length: 50 }, (_, i) => job(i + 1));
const failedState = (m: ManifestJob[]): RunnerState => ({ jobs: Object.fromEntries(m.map(j => [j.id, { id: j.id, projectId: `p-${j.id}`, normalFailures: 3, attemptPhase: 'none', status: 'failed', updatedAt: '2020-01-01T00:00:00.000Z' }])) });
async function fixture(state: RunnerState, m = manifest()) { const dir = await mkdtemp(join(tmpdir(), 'gruia-b2b50-')); await Promise.all([writeFile(join(dir, 'gate.json'), JSON.stringify({ approved: true })), writeFile(join(dir, 'manifest.json'), JSON.stringify(m)), writeFile(join(dir, 'state.json'), JSON.stringify(state)), writeFile(join(dir, 'credentials.json'), JSON.stringify({ email: 'e@example.test', password: 'secret' }))]); return dir; }
const response = (data: unknown, status = 200) => new Response(typeof data === 'string' ? data : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('classifies quota failures separately from ordinary failures', () => {
  assert.equal(classifyQuotaError('rate_limit exceeded; resets in 30 minutes'), true);
  assert.equal(classifyQuotaError({ error: "You've hit your limit" }), true);
  assert.equal(classifyQuotaError('invalid prompt schema'), false);
});
test('delivered HTML requires substantial interactive markup', () => {
  assert.equal(isDeliveredHtml('<html><body><style></style><script></script><main>x</main></body></html>'), false);
  assert.equal(isDeliveredHtml(`<html><style>${'x'.repeat(3000)}</style><body><main>${'x'.repeat(3000)}</main><script>x()</script><button>go</button></body></html>`), true);
});
test('a live runner lock is never removed by a second invocation', async () => {
  const m = manifest(), state = failedState(m), dir = await fixture(state, m);
  await writeFile(join(dir, 'runner.lock'), JSON.stringify({ pid: process.pid }));
  await assert.rejects(main(['--once'], { stateDir: dir }), /another runner instance is active/);
  assert.equal(JSON.parse(await readFile(join(dir, 'runner.lock'), 'utf8')).pid, process.pid);
});
test('review is read-only: it neither authenticates nor creates runner files', async () => {
  const m = manifest(), state = failedState(m), dir = await fixture(state, m);
  const before = await readFile(join(dir, 'state.json'), 'utf8');
  await main(['--review'], { stateDir: dir, fetch: (() => { throw new Error('network must not be called'); }) as typeof fetch, log: () => {} });
  assert.equal(await readFile(join(dir, 'state.json'), 'utf8'), before);
  await assert.rejects(access(join(dir, 'runner.lock')));
  await assert.rejects(access(join(dir, 'index.json')));
});
test('a closed gate blocks before every write-capable runner boundary', async () => {
  const m = manifest(), state = failedState(m), dir = await fixture(state, m);
  await writeFile(join(dir, 'gate.json'), JSON.stringify({ approved: false }));
  const before = await readFile(join(dir, 'state.json'), 'utf8');
  await assert.rejects(main(['--once'], { stateDir: dir, fetch: (() => { throw new Error('network must not be called'); }) as typeof fetch }), /gate is not approved/);
  assert.equal(await readFile(join(dir, 'state.json'), 'utf8'), before);
  await assert.rejects(access(join(dir, 'runner.lock')));
  await assert.rejects(access(join(dir, 'index.json')));
});
test('a persisted completed pilot is not reset by later pilot capture', async () => {
  const m = manifest(), state = failedState(m); state.jobs['01'] = { id: '01', projectId: 'saved-project', normalFailures: 0, attemptPhase: 'none', status: 'succeeded', updatedAt: '2020-01-01T00:00:00.000Z' };
  const dir = await fixture(state, m); await writeFile(join(dir, 'pilot-01.json'), JSON.stringify({ id: '01', projectId: 'other-project', runId: 'other-run', prompt: 'must not replace' }));
  await main(['--once'], { stateDir: dir, fetch: (() => { throw new Error('no work should run'); }) as typeof fetch });
  const result = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
  assert.equal(result.jobs['01'].status, 'succeeded'); assert.equal(result.jobs['01'].projectId, 'saved-project');
});
test('terminal ordinary failure clears the old attempt and next pass creates a new identity', async () => {
  const m = manifest(), state = failedState(m); state.jobs['01'] = { id: '01', projectId: 'p-01', conversationId: 'c-01', clientRequestId: 'old-client', userMessageId: 'old-user', assistantMessageId: 'old-assistant', runId: 'old-run', normalFailures: 0, attemptPhase: 'active', status: 'running', updatedAt: '2020-01-01T00:00:00.000Z' };
  const dir = await fixture(state, m); let phase = 0; const posts: any[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => { const url = String(input);
    if (url.endsWith('/api/runs/old-run')) return response({ run: { status: 'failed', error: 'bad output' } });
    if (url.includes('/api/runs?projectId=')) return response({ runs: [] });
    if (url.includes('/messages/')) return response({});
    if (url.endsWith('/api/runs') && init?.method === 'POST') { posts.push(JSON.parse(String(init.body))); return response({ runId: 'new-run' }); }
    if (url.endsWith('/api/runs/new-run')) return response({ run: { status: 'queued' } });
    if (url.endsWith('/events')) return response({}, 503);
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  await main(['--once'], { stateDir: dir, fetch: fetcher });
  let saved = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8')).jobs['01'];
  assert.equal(saved.status, 'pending'); assert.equal(saved.normalFailures, 1); assert.equal(saved.runId, undefined); assert.equal(saved.clientRequestId, undefined);
  phase++; await main(['--once'], { stateDir: dir, fetch: fetcher });
  saved = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8')).jobs['01'];
  assert.equal(posts.length, 1); assert.notEqual(posts[0].clientRequestId, 'old-client'); assert.equal(saved.runId, 'new-run');
});
test('quota terminal pauses globally without consuming an ordinary refinement failure', async () => {
  const m = manifest(), state = failedState(m); state.jobs['01'] = { id: '01', projectId: 'p-01', conversationId: 'c-01', clientRequestId: 'quota-client', runId: 'quota-run', normalFailures: 1, attemptPhase: 'active', status: 'running', updatedAt: '2020-01-01T00:00:00.000Z' };
  const dir = await fixture(state, m);
  await main(['--once'], { stateDir: dir, fetch: (async (input: RequestInfo | URL) => { if (String(input).endsWith('/api/runs/quota-run')) return response({ run: { status: 'failed', error: 'quota reset in 30 minutes' } }); throw new Error('unexpected'); }) as typeof fetch, now: () => 0 });
  const saved = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
  assert.equal(saved.jobs['01'].status, 'paused'); assert.equal(saved.jobs['01'].normalFailures, 1); assert.equal(saved.jobs['01'].runId, undefined); assert.equal(saved.pauseUntil, '1970-01-01T00:30:00.000Z');
});
test('lost run POST recovers matching client request instead of minting another attempt', async () => {
  const m = manifest(), state = failedState(m); state.jobs['01'] = { id: '01', projectId: 'p-01', conversationId: 'c-01', clientRequestId: 'stable-client', userMessageId: 'stable-user', assistantMessageId: 'stable-assistant', normalFailures: 0, attemptPhase: 'prepared', status: 'pending', updatedAt: '2020-01-01T00:00:00.000Z' };
  const dir = await fixture(state, m); let lists = 0, posts = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => { const url = String(input);
    if (url.includes('/api/runs?projectId=')) return response({ runs: lists++ ? [{ id: 'recovered-run', clientRequestId: 'stable-client' }] : [] });
    if (url.includes('/messages/')) return response({});
    if (url.endsWith('/api/runs') && init?.method === 'POST') { posts++; throw new Error('lost response'); }
    if (url.endsWith('/api/runs/recovered-run')) return response({ run: { status: 'queued' } });
    if (url.endsWith('/events')) return response({}, 503);
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch;
  await main(['--once'], { stateDir: dir, fetch: fetcher });
  const saved = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8')).jobs['01'];
  assert.equal(posts, 1); assert.equal(saved.clientRequestId, 'stable-client'); assert.equal(saved.userMessageId, 'stable-user'); assert.equal(saved.runId, 'recovered-run');
});
test('a disconnected stream with an active authoritative run exits the pass without duplication', async () => {
  const m = manifest(), state = failedState(m); state.jobs['01'] = { id: '01', projectId: 'p-01', conversationId: 'c-01', clientRequestId: 'active-client', runId: 'active-run', normalFailures: 0, attemptPhase: 'active', status: 'running', updatedAt: '2020-01-01T00:00:00.000Z' };
  const dir = await fixture(state, m); let posts = 0;
  await main(['--once'], { stateDir: dir, fetch: (async (input: RequestInfo | URL, init?: RequestInit) => { const url = String(input); if (url.endsWith('/api/runs/active-run')) return response({ run: { status: 'running' } }); if (url.endsWith('/events')) return response({}, 503); if (url.endsWith('/api/runs') && init?.method === 'POST') posts++; throw new Error(`unexpected ${url}`); }) as typeof fetch });
  const saved = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8')).jobs['01'];
  assert.equal(posts, 0); assert.equal(saved.runId, 'active-run'); assert.equal(saved.status, 'running');
});
test('SSE end is followed by authoritative status and saves all delivered documents', async () => {
  const m = manifest(), state = failedState(m); state.jobs['01'] = { id: '01', projectId: 'p-01', conversationId: 'c-01', clientRequestId: 'done-client', runId: 'done-run', normalFailures: 0, attemptPhase: 'active', status: 'running', updatedAt: '2020-01-01T00:00:00.000Z' };
  const dir = await fixture(state, m); let statuses = 0; const html = `<html><style>${'x'.repeat(3000)}</style><body><main>${'x'.repeat(3000)}</main><script>x()</script><button>go</button></body></html>`;
  await main(['--once'], { stateDir: dir, fetch: (async (input: RequestInfo | URL) => { const url = String(input);
    if (url.endsWith('/api/runs/done-run')) return response({ run: { status: statuses++ ? 'succeeded' : 'queued' } });
    if (url.endsWith('/events')) return new Response('event: end\ndata: {"status":"queued"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    if (url.endsWith('/files')) return response({ files: [{ name: 'index.html' }, { name: 'DESIGN.md' }, { name: 'README.md' }] });
    if (url.endsWith('/raw/index.html')) return response(html);
    if (url.endsWith('/raw/DESIGN.md')) return response('# Design');
    if (url.endsWith('/raw/README.md')) return response('# Readme');
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch });
  const saved = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8')).jobs['01'];
  assert.equal(statuses, 2); assert.equal(saved.status, 'succeeded');
  assert.equal(await readFile(join(dir, 'outputs', '01', 'DESIGN.md'), 'utf8'), '# Design');
  assert.equal(JSON.parse(await readFile(join(dir, 'index.json'), 'utf8')).length, 50);
});

function activeState(...ids: string[]) { const state = failedState(manifest()); for (const id of ids) state.jobs[id] = { id, projectId: `p-${id}`, conversationId: `c-${id}`, runId: `run-${id}`, clientRequestId: `client-${id}`, normalFailures: 0, attemptPhase: 'active', status: 'running', updatedAt: '2020-01-01T00:00:00.000Z' }; return state; }
const completeHtml = `<html><style>${'x'.repeat(3000)}</style><body><main>${'x'.repeat(3000)}</main><button>go</button></body></html>`;
function deliveredResponse(url: string): Response | undefined {
  if (/\/api\/runs\/run-\d+$/.test(url)) return response({ status: 'succeeded' });
  if (url.endsWith('/files')) return response({ files: ['index.html','DESIGN.md','README.md'].map(name => ({ name })) });
  if (url.endsWith('/raw/index.html')) return response(completeHtml);
  if (url.endsWith('/raw/DESIGN.md')) return response('# Design');
  if (url.endsWith('/raw/README.md')) return response('# Readme');
}
test('normal mode yields after a disconnected active run, without --once', async () => {
  const dir = await fixture(activeState('01')); let calls = 0;
  await main([], { stateDir: dir, fetch: (async (input: RequestInfo | URL) => { calls++; if (calls > 6) throw new Error('authentication stop for regression safety'); if (String(input).endsWith('/events')) return new Response(''); return response({status:'running'}); }) as typeof fetch });
  assert.equal(calls, 3); const saved = JSON.parse(await readFile(join(dir,'state.json'),'utf8')).jobs['01']; assert.equal(saved.runId,'run-01'); assert.equal(saved.normalFailures,0);
});
test('normal mode yields on gateway 502 without spending a model attempt', async () => {
  const dir = await fixture(activeState('01')); let calls = 0;
  await main([], { stateDir: dir, fetch: (async () => { if (++calls > 6) throw new Error('authentication stop for regression safety'); return response('Bad gateway',502); }) as typeof fetch });
  assert.equal(calls,1); const saved = JSON.parse(await readFile(join(dir,'state.json'),'utf8')).jobs['01']; assert.equal(saved.runId,'run-01'); assert.equal(saved.normalFailures,0);
});
test('successful normal-mode batches continue to remaining jobs', async () => {
  const dir = await fixture(activeState('01','02','03')); const checked: string[] = [];
  await main([], { stateDir:dir, prototypeQa: async (_dir,id) => { checked.push(id); return {ok:true,issues:[]}; }, fetch: (async (input: RequestInfo | URL) => { const result = deliveredResponse(String(input)); if (!result) throw new Error(`unexpected ${input}`); return result; }) as typeof fetch });
  assert.deepEqual(checked.sort(),['01','02','03']); const saved = JSON.parse(await readFile(join(dir,'state.json'),'utf8')); assert.equal(saved.jobs['03'].status,'succeeded');
});
test('expired sessions can authenticate twice in the same process', async () => {
  const dir = await fixture(activeState('01')); let logins = 0; const expired = new Set<string>();
  await main([], { stateDir:dir, fetch: (async (input: RequestInfo | URL,init?: RequestInit) => { const url = String(input);
    if (url.endsWith('/auth/login')) { if (init?.method === 'POST') return new Response('', {status:303,headers:{'Set-Cookie':`__Host-gruia_design_session=fresh-${++logins}; Path=/; Secure`}}); return new Response('<input name="csrf" value="csrf-fixture">'); }
    if ((url.endsWith('/api/runs/run-01') || url.endsWith('/files')) && !expired.has(url)) { expired.add(url); return response({},401); }
    const result = deliveredResponse(url); if (!result) throw new Error(`unexpected ${input}`); return result;
  }) as typeof fetch });
  assert.equal(logins,2); assert.equal(JSON.parse(await readFile(join(dir,'state.json'),'utf8')).jobs['01'].status,'succeeded');
});
test('browser QA runs after files exist and feeds specific defects into refinement', async () => {
  const dir = await fixture(activeState('01')); let refinement = ''; let qaCalls = 0;
  const fetcher = (async (input: RequestInfo | URL,init?: RequestInit) => { const url = String(input);
    if (url.includes('/api/runs?')) return response({runs:[]});
    if (url.includes('/messages/')) return response({});
    if (url.endsWith('/api/runs') && init?.method === 'POST') { refinement = JSON.parse(String(init.body)).currentPrompt; return response({runId:'new-run'}); }
    if (url.endsWith('/api/runs/new-run')) return response({status:'running'});
    if (url.endsWith('/events')) return new Response('');
    const result=deliveredResponse(url); if (!result) throw new Error(`unexpected ${url}`); return result;
  }) as typeof fetch;
  await main([], {stateDir:dir,fetch:fetcher,prototypeQa:async (stateDir,id) => { qaCalls++; assert.equal(await readFile(join(stateDir,'outputs',id,'index.html'),'utf8'),completeHtml); return {ok:false,issues:['mobile: horizontal overflow','desktop: broken section links #pricing']}; }});
  assert.equal(qaCalls,1); assert.match(refinement,/mobile: horizontal overflow/); assert.match(refinement,/#pricing/); const saved=JSON.parse(await readFile(join(dir,'state.json'),'utf8')).jobs['01']; assert.equal(saved.normalFailures,1); assert.equal(saved.runId,'new-run');
});
test('browser QA infrastructure errors keep original run without a rewrite', async () => {
  const dir = await fixture(activeState('01')); let posts = 0;
  await main([], {stateDir:dir,prototypeQa:async()=>({ok:false,issues:['desktop: preview HTTP 502','desktop: incomplete content']}),fetch:(async (input:RequestInfo|URL,init?:RequestInit)=>{ if(init?.method==='POST')posts++; const result=deliveredResponse(String(input)); if(!result)throw new Error(`unexpected ${input}`);return result;})as typeof fetch});
  const saved=JSON.parse(await readFile(join(dir,'state.json'),'utf8')).jobs['01']; assert.equal(posts,0); assert.equal(saved.normalFailures,0); assert.equal(saved.runId,'run-01'); assert.equal(saved.qaIssues,undefined);
});
test('malformed existing state is preserved and never replaced with seeded jobs', async () => {
  const dir=await fixture(activeState('01'));const corrupt='{"jobs":';await writeFile(join(dir,'state.json'),corrupt);
  await assert.rejects(main([],{stateDir:dir,fetch:(()=>{throw new Error('network must not be called');}) as typeof fetch}),SyntaxError);
  assert.equal(await readFile(join(dir,'state.json'),'utf8'),corrupt);await assert.rejects(access(join(dir,'index.json')));
});
test('invalid state shape is preserved even when it parses as JSON', async () => {
  const dir=await fixture(activeState('01'));const corrupt='{"jobs":[]}';await writeFile(join(dir,'state.json'),corrupt);
  await assert.rejects(main([],{stateDir:dir}),/state.json contains invalid jobs/);assert.equal(await readFile(join(dir,'state.json'),'utf8'),corrupt);
});

test('scheduler fills six slots, max three per model, and replaces fast completion independently', async () => {
  const state=activeState('01','02','03','04','05','06','07','08');
  const dir=await fixture(state);const started:string[]=[];const active=new Set<string>();let peak=0;let modelPeak=0;
  const releases=new Map<string,()=>void>();
  let sixStarted!:()=>void; const firstWave=new Promise<void>(resolve=>{sixStarted=resolve;});
  let replacementStarted!:()=>void; const replacement=new Promise<void>(resolve=>{replacementStarted=resolve;});
  const operation=main([], {stateDir:dir,concurrency:6,fetch:(async(input:RequestInfo|URL)=>{
    const url=String(input),match=url.match(/\/api\/runs\/run-(\d+)$/);
    if(match){ const id=match[1];started.push(id);active.add(id);peak=Math.max(peak,active.size);modelPeak=Math.max(modelPeak,...[0,1].map(parity=>[...active].filter(n=>Number(n)%2===parity).length));
      if(started.length===6)sixStarted();if(started.length===7)replacementStarted();
      await new Promise<void>(resolve=>releases.set(id,resolve)); active.delete(id);return response({status:'succeeded'});
    }
    const result=deliveredResponse(url);if(!result)throw new Error(`unexpected ${url}`);return result;
  })as typeof fetch});
  await firstWave;assert.equal(started.length,6);releases.get('01')!();await replacement;
  assert.equal(started[6],'07');assert.equal(active.has('02'),true,'slow Opus run still active when next Fable starts');
  for(const release of releases.values())release();
  // The final adopted run starts after another slot opens; release it through an event, not polling.
  const eighth = new Promise<void>(resolve=>{
    const originalSet=releases.set.bind(releases);releases.set=(id,release)=>{const result=originalSet(id,release);if(id==='08'){release();resolve();}return result;};
    if(releases.has('08')){releases.get('08')!();resolve();}
  });
  await eighth;await operation;assert.equal(peak,6);assert.equal(modelPeak,3);assert.equal(started.length,8);
});

test('configured concurrency above eight is rejected before dispatch',async()=>{
  const dir=await fixture(activeState('01'));let calls=0;
  await assert.rejects(main([],{stateDir:dir,concurrency:9,fetch:(async()=>{calls++;return response({});})as typeof fetch}),/between 1 and 8/);assert.equal(calls,0);
});

for (const stage of ['GET','POST'] as const) for (const code of [502,429,401,403]) {
  test(`session renewal ${stage} HTTP ${code} preserves transient/fatal classification`,async()=>{
    const dir=await fixture(activeState('01'));let authCalls=0;
    await main([], {stateDir:dir,now:()=>0,fetch:(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      if(url.endsWith('/auth/login')){
        authCalls++;
        if((init?.method??'GET')===stage)return response('temporarily unavailable',code);
        return new Response('<input name="csrf" value="csrf-fixture">');
      }
      return response({},401);
    })as typeof fetch});
    const saved=JSON.parse(await readFile(join(dir,'state.json'),'utf8'));
    assert.equal(authCalls,stage==='GET'?1:2);assert.equal(saved.jobs['01'].runId,'run-01');assert.equal(saved.jobs['01'].normalFailures,0);
    if(code===429){assert.equal(saved.jobs['01'].status,'paused');assert.equal(saved.pauseUntil,'1970-01-01T00:30:00.000Z');assert.equal(saved.stopQueue,undefined);}
    else if(code>=500){assert.equal(saved.jobs['01'].status,'pending');assert.equal(saved.stopQueue,undefined);assert.match(saved.jobs['01'].error,/HTTP 502/);}
    else {assert.equal(saved.jobs['01'].status,'needs_attention');assert.equal(saved.stopQueue,true);assert.match(saved.jobs['01'].error,new RegExp(`HTTP ${code}`));}
  });
}

test('quota classifier reads Error messages and HTTP status metadata',()=>{
  assert.equal(classifyQuotaError(new Error('usage limit reached')),true);
  assert.equal(classifyQuotaError(Object.assign(new Error('temporary upstream failure'),{status:429})),true);
  assert.equal(classifyQuotaError(Object.assign(new Error('temporary upstream failure'),{status:502})),false);
});

test('native dispatch is bounded to eight with independent Fable five and Opus three ceilings',async()=>{
  const state=failedState(manifest());for(let n=1;n<=12;n++){const id=String(n).padStart(2,'0');state.jobs[id]={id,projectId:`p-${id}`,conversationId:`c-${id}`,normalFailures:0,attemptPhase:'none',status:'pending',updatedAt:'2020-01-01T00:00:00.000Z'};}
  const dir=await fixture(state);const posts:any[]=[];const streams:ReadableStreamDefaultController<Uint8Array>[]=[];
  let allStarted!:()=>void;const ready=new Promise<void>(resolve=>{allStarted=resolve;});
  const operation=main([], {stateDir:dir,concurrency:8,fableConcurrency:5,opusConcurrency:3,fetch:(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input);
    if(url.includes('/api/runs?'))return response({runs:[]});
    if(url.includes('/messages/'))return response({});
    if(url.endsWith('/api/runs')&&init?.method==='POST'){const body=JSON.parse(String(init.body));posts.push(body);return response({runId:`native-${body.projectId}`});}
    if(url.endsWith('/events'))return new Response(new ReadableStream<Uint8Array>({start(controller){streams.push(controller);if(streams.length===8)allStarted();}}));
    if(url.includes('/api/runs/native-'))return response({status:'running'});
    throw new Error(`unexpected ${url}`);
  })as typeof fetch});
  await ready;assert.equal(posts.length,8);assert.equal(posts.filter(p=>p.model==='claude-fable-5-1').length,5);assert.equal(posts.filter(p=>p.model==='claude-opus-5').length,3);
  for(const controller of streams)controller.close();await operation;assert.equal(posts.length,8,'disconnect yields rather than refilling or duplicating');
});
