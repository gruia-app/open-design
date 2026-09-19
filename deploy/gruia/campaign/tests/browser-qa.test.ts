import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPrototype } from '../browser-qa.ts';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The QA scope guard must reject malformed ids and project ids before a
// browser is ever launched — the values are later used in paths and URLs.
test('rejects non-numeric or oversized job ids', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qa-'));
  await assert.rejects(checkPrototype(dir, 'abc', 'proj'), /Invalid QA scope/);
  await assert.rejects(checkPrototype(dir, '1', 'proj'), /Invalid QA scope/);
  await assert.rejects(checkPrototype(dir, '../07', 'proj'), /Invalid QA scope/);
  await assert.rejects(checkPrototype(dir, '007', 'proj'), /Invalid QA scope/);
});

test('rejects project ids with path or URL characters', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qa-'));
  await assert.rejects(checkPrototype(dir, '07', 'a/b'), /Invalid QA scope/);
  await assert.rejects(checkPrototype(dir, '07', 'a?x=1'), /Invalid QA scope/);
  await assert.rejects(checkPrototype(dir, '07', 'a.b/../../etc'), /Invalid QA scope/);
  await assert.rejects(checkPrototype(dir, '07', ''), /Invalid QA scope/);
});
