import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyRemotePublic } from '../public-verifier.ts';

// The remote probe fetches an arbitrary URL over ssh; the URL guard is the
// only thing keeping the check on public Vercel deployments instead of
// internal addresses. Rejections must happen before any execFile call.
test('rejects non-https public URLs', async () => {
  await assert.rejects(
    verifyRemotePublic('http://example.vercel.app/', 'brand', '0'.repeat(64)),
    /not a Vercel deployment/,
  );
});

test('rejects hosts outside *.vercel.app', async () => {
  await assert.rejects(
    verifyRemotePublic('https://169.254.169.254/latest/meta-data', 'brand', '0'.repeat(64)),
    /not a Vercel deployment/,
  );
  await assert.rejects(
    verifyRemotePublic('https://vercel.app.evil.test/', 'brand', '0'.repeat(64)),
    /not a Vercel deployment/,
  );
});

test('rejects URLs embedding credentials', async () => {
  await assert.rejects(
    verifyRemotePublic('https://user:pass@x.vercel.app/', 'brand', '0'.repeat(64)),
    /not a Vercel deployment/,
  );
});
