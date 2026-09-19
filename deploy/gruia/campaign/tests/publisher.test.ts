import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { main } from '../publisher.ts';

const fixedNow = () => Date.parse('2025-01-02T03:04:05.000Z');
const designId = (id: string) => `00000000-0000-4000-8000-${id.padStart(12, '0')}`;
const html = (id: string) => `<!doctype html><html><body><main><h1>Example Brand ${id}</h1><p>${'durable preview '.repeat(500)}</p></main></body></html>`;
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
type ApiCall = { path: string; init?: RequestInit };

function deployment(id: string) {
  return { id: `10000000-0000-4000-8000-${id.padStart(12, '0')}`, projectId: designId(id), deploymentId: `dpl_${id}`, url: `https://preview-${id}.example.test`, status: 'ready' };
}

async function fixture(options: { ids?: string[]; qaOk?: boolean; stateStatus?: 'succeeded' | 'failed'; published02?: boolean } = {}) {
  const ids = options.ids ?? ['03'];
  const dir = await mkdtemp(join(tmpdir(), 'gruia-b2b50-publisher-'));
  const jobs = Object.fromEntries(ids.map(id => [id, { id, projectId: designId(id), status: options.stateStatus ?? 'succeeded' }]));
  await writeFile(join(dir, 'state.json'), JSON.stringify({ jobs }, null, 2));
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(ids.map(id => ({ id, name: `Example Brand ${id}` }))));
  await writeFile(join(dir, 'vercel-connection.json'), JSON.stringify({ teamId: 'team-fixture' }));
  for (const id of ids) {
    const local = html(id);
    await mkdir(join(dir, 'outputs', id), { recursive: true });
    await writeFile(join(dir, 'outputs', id, 'index.html'), local);
    await writeFile(join(dir, 'outputs', id, 'qa.json'), JSON.stringify({ ok: options.qaOk ?? true, localHTMLSHA256: sha(local) }));
  }
  if (options.published02) await writeFile(join(dir, 'published-02.json'), JSON.stringify({ id: '02', url: 'https://existing-02.example.test', deploymentId: 'vercel-02' }));
  return dir;
}

function nativeApi(calls: ApiCall[], options: { raw?: Record<string, string>; histories?: () => unknown; onPost?: (id: string) => Promise<unknown> | unknown } = {}) {
  return {
    async request(path: string, init?: RequestInit): Promise<any> {
      calls.push({ path, init });
      const id = path.match(/^\/api\/projects\/([\w-]+)/)?.[1];
      const designJob = id ? Object.keys(options.raw ?? {}).find(job => designId(job) === id) : undefined;
      if (init?.method === 'POST' && /\/deploy$/.test(path)) return options.onPost?.(designJob ?? '') ?? deployment(designJob ?? '03');
      if (/\/deployments$/.test(path)) return options.histories?.() ?? { deployments: [] };
      if (/\/raw\/index\.html$/.test(path)) return (designJob && options.raw?.[designJob]) ?? html('03');
      throw new Error(`unexpected native request ${init?.method ?? 'GET'} ${path}`);
    },
  };
}

function vercel(options: { projectName?: (id: string) => string; deploymentProjectId?: (id: string) => string } = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    const id = url.match(/(?:dpl_|vercel-project-)(\d{2})/)?.[1] ?? '03';
    if (url.includes('/v13/deployments/')) return new Response(JSON.stringify({ id: `dpl_${id}`, projectId: options.deploymentProjectId?.(id) ?? `vercel-project-${id}` }), { status: 200 });
    if (url.includes('/v9/projects/')) return new Response(JSON.stringify({ name: options.projectName?.(id) ?? `od-${designId(id)}` }), { status: 200 });
    throw new Error(`unexpected Vercel request ${init?.method ?? 'GET'} ${url}`);
  };
  return { calls, fetcher };
}

function verifier(status = 200, body = html('03')) {
  return async (_url: string, expectedBrand: string, _hash: string) => ({ status, body: body.replace('Example Brand 03', expectedBrand) });
}

function postCount(calls: ApiCall[]) { return calls.filter(call => call.init?.method === 'POST' && /\/deploy$/.test(call.path)).length; }

test('failed QA is ineligible and never calls the native deploy POST', async () => {
  const dir = await fixture({ qaOk: false }); const calls: ApiCall[] = [];
  await main({ stateDir: dir, api: nativeApi(calls, { raw: { '03': html('03') } }), vercelFetch: vercel().fetcher, verifyPublic: verifier(), now: fixedNow });
  assert.equal(postCount(calls), 0);
});

test('public verification follows the approved document title when the model renames the example', async () => {
  const dir = await fixture();
  const renamed = `<!doctype html><html><head><title>Actual Brand · Dashboard</title></head><body><main><h1>Actual Brand</h1><p>${'durable preview '.repeat(500)}</p></main></body></html>`;
  await writeFile(join(dir, 'outputs', '03', 'index.html'), renamed);
  await writeFile(join(dir, 'outputs', '03', 'qa.json'), JSON.stringify({ ok: true, localHTMLSHA256: sha(renamed) }));
  const calls: ApiCall[] = [];
  await main({ stateDir: dir, api: nativeApi(calls, { raw: { '03': renamed } }), vercelFetch: vercel().fetcher, verifyPublic: async (_url, expectedBrand) => ({ status: 200, body: renamed.includes(expectedBrand) ? renamed : '<html>wrong identity</html>' }), now: fixedNow });
  const ledger = JSON.parse(await readFile(join(dir, 'publications.json'), 'utf8'));
  assert.equal(ledger.publications['03'].stage, 'published');
});

test('publishing leaves every originally accepted campaign HTML and state record byte-for-byte unchanged', async () => {
  const ids = ['01', '02', '03', '04']; const dir = await fixture({ ids });
  const before = await Promise.all(ids.map(id => readFile(join(dir, 'outputs', id, 'index.html'), 'utf8')));
  const stateBefore = await readFile(join(dir, 'state.json'), 'utf8'); const calls: ApiCall[] = [];
  const vf = vercel();
  await main({ stateDir: dir, api: nativeApi(calls, { raw: Object.fromEntries(ids.map(id => [id, html(id)])) }), vercelFetch: vf.fetcher, verifyPublic: async (url) => ({ status: 200, body: html(url.match(/preview-(\d+)/)?.[1] ?? '03') }), now: fixedNow });
  assert.deepEqual(await Promise.all(ids.map(id => readFile(join(dir, 'outputs', id, 'index.html'), 'utf8'))), before);
  assert.equal(await readFile(join(dir, 'state.json'), 'utf8'), stateBefore);
  assert.equal(postCount(calls), 4);
  const ledger = JSON.parse(await readFile(join(dir, 'publications.json'), 'utf8'));
  assert.deepEqual(Object.values(ledger.publications).map((p: any) => p.stage), ['published','published','published','published']);
});

test('a repeat pass uses the published ledger and does not POST another deployment', async () => {
  const dir = await fixture(); const calls: ApiCall[] = []; const vf = vercel();
  const options = { stateDir: dir, api: nativeApi(calls, { raw: { '03': html('03') } }), vercelFetch: vf.fetcher, verifyPublic: verifier(), now: fixedNow };
  await main(options); await main(options);
  assert.equal(postCount(calls), 1);
  const ledger = JSON.parse(await readFile(join(dir, 'publications.json'), 'utf8'));
  assert.equal(ledger.publications['03'].stage, 'published');
});

test('a lost native POST response is recovered from matching current deployment history without a duplicate POST', async () => {
  const dir = await fixture(); const calls: ApiCall[] = []; let lost = false;
  const vf = vercel();
  await main({
    stateDir: dir,
    api: nativeApi(calls, {
      raw: { '03': html('03') },
      histories: () => ({ deployments: lost ? [{ ...deployment('03'), providerId: 'vercel-self', fileName: 'index.html', updatedAt: fixedNow() + 1000 }] : [] }),
      onPost: async () => { lost = true; throw new Error('connection reset after accepted request'); },
    }),
    vercelFetch: vf.fetcher,
    verifyPublic: verifier(),
    now: fixedNow,
  });
  assert.equal(postCount(calls), 1);
  const ledger = JSON.parse(await readFile(join(dir, 'publications.json'), 'utf8'));
  assert.equal(ledger.publications['03'].stage, 'published');
  assert.equal(ledger.publications['03'].deploymentId, 'dpl_03');
});

test('a deployment attached to a Vercel project with the wrong owned-name never disables SSO protection', async () => {
  const dir = await fixture(); const calls: ApiCall[] = [];
  const vf = vercel({ projectName: () => 'od-some-other-design-project' });
  await main({ stateDir: dir, api: nativeApi(calls, { raw: { '03': html('03') } }), vercelFetch: vf.fetcher, verifyPublic: verifier(), now: fixedNow });
  assert.equal(vf.calls.some(call => call.init?.method === 'PATCH'), false);
});

test('a failed public verification is recorded but never advances the ledger entry to published', async () => {
  const dir = await fixture(); const calls: ApiCall[] = []; const vf = vercel();
  await main({ stateDir: dir, api: nativeApi(calls, { raw: { '03': html('03') } }), vercelFetch: vf.fetcher, verifyPublic: verifier(403, 'VercelSecurityCheckpoint'), now: fixedNow });
  const ledger = JSON.parse(await readFile(join(dir, 'publications.json'), 'utf8'));
  assert.notEqual(ledger.publications['03'].stage, 'published');
  assert.equal(typeof ledger.publications['03'].error, 'string');
  assert.doesNotMatch(ledger.publications['03'].error, /VercelSecurityCheckpoint|connection reset|token|authorization/i);
});


test('a lost POST with no history remains pending on subsequent passes, never blindly redeploying', async () => {
  const dir = await fixture(); const calls: ApiCall[] = [];
  const options = { stateDir: dir, api: nativeApi(calls, { raw: {'03':html('03')}, onPost:()=>{throw new Error('lost')} }), vercelFetch: vercel().fetcher, verifyPublic: verifier(), now:fixedNow };
  await main(options); await main(options);
  assert.equal(postCount(calls),1);
  const ledger=JSON.parse(await readFile(join(dir,'publications.json'),'utf8'));
  assert.equal(ledger.publications['03'].stage,'pending');
});
test('a public deployment serving different bytes than the approved HTML is never confirmed published', async () => {
  const dir = await fixture(); const calls: ApiCall[] = [];
  await main({
    stateDir: dir,
    api: nativeApi(calls, { raw: { '03': html('03') } }),
    vercelFetch: vercel().fetcher,
    verifyPublic: async () => ({ status: 200, body: `${html('03')}<!-- tampered upstream -->` }),
    now: fixedNow,
  });
  const ledger = JSON.parse(await readFile(join(dir, 'publications.json'), 'utf8'));
  assert.notEqual(ledger.publications['03'].stage, 'published');
  assert.equal(ledger.publications['03'].error, 'public URL content differs from the approved local HTML');
});

test('a truncated public body can never be pinned and is never published', async () => {
  const dir = await fixture(); const calls: ApiCall[] = [];
  await main({
    stateDir: dir,
    api: nativeApi(calls, { raw: { '03': html('03') } }),
    vercelFetch: vercel().fetcher,
    verifyPublic: async () => ({ status: 200, body: html('03'), sha256: sha(html('03')), truncated: true }),
    now: fixedNow,
  });
  const ledger = JSON.parse(await readFile(join(dir, 'publications.json'), 'utf8'));
  assert.notEqual(ledger.publications['03'].stage, 'published');
  assert.equal(ledger.publications['03'].error, 'public URL body exceeded the verification size limit');
});

test('a changed local HTML cannot reuse an older published deployment under a new digest', async()=>{
  const dir=await fixture();const calls:ApiCall[]=[];const vf=vercel();
  const options={stateDir:dir,api:nativeApi(calls,{raw:{'03':html('03')}}),vercelFetch:vf.fetcher,verifyPublic:verifier(),now:fixedNow};
  await main(options);const before=await readFile(join(dir,'publications.json'),'utf8');
  const changed=html('03')+'<!-- edited -->';await writeFile(join(dir,'outputs','03','index.html'),changed);await writeFile(join(dir,'outputs','03','qa.json'),JSON.stringify({ok:true,localHTMLSHA256:sha(changed)}));
  const result=await main(options);assert.equal(result.deferred,1);assert.equal(postCount(calls),1);assert.equal(await readFile(join(dir,'publications.json'),'utf8'),before);
});
