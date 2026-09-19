import { execFile } from 'node:child_process';
import type { PublicCheck } from './publisher.ts';

const probe = `import json,sys,urllib.request,urllib.error,hashlib
u=json.load(sys.stdin)['url']
try:
 r=urllib.request.urlopen(u,timeout=35)
except urllib.error.HTTPError as e:
 r=e
h=hashlib.sha256();buf=b'';total=0;cap=16777216
while total<cap:
 c=r.read(min(65536,cap-total))
 if not c:break
 total+=len(c);h.update(c);buf+=c
overflow=r.read(1)!=b''
body=buf[:2097152].decode('utf-8','replace')
print(json.dumps({'status':r.status,'body':body,'sha256':h.hexdigest(),'truncated':overflow}))`;
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
async function probeOnce(url: string): Promise<PublicCheck> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.vercel.app') || parsed.username || parsed.password) throw new Error('public URL is not a Vercel deployment');
  return new Promise((resolve, reject) => {
    const child = execFile('ssh', [process.env.GRUIA_PUBLIC_VERIFY_HOST ?? 'demo-apps-root', 'python3 -c ' + quote(probe)], { timeout: 45_000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) { reject(new Error('public URL probe failed')); return; }
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('public URL probe returned invalid data')); }
    });
    child.stdin?.end(JSON.stringify({ url }));
  });
}

export async function verifyRemotePublic(url: string, expectedBrand: string): Promise<PublicCheck> {
  let result: PublicCheck = { status: 0, body: '' };
  for (let attempt = 0; attempt < 3; attempt++) {
    result = await probeOnce(url);
    if (result.status === 200 && result.body.toLowerCase().includes(expectedBrand.toLowerCase()) && !/authentication required|security checkpoint/i.test(result.body)) return result;
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  return result;
}
