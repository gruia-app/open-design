import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const repository = process.env.GRUIA_DESIGN_REPO ?? resolve(import.meta.dirname, '../../..');
const { chromium } = require(join(repository, 'e2e/node_modules/@playwright/test'));
export async function checkPrototype(stateDir: string, id: string, projectId: string): Promise<{ok:boolean; issues:string[]}> {
  if (!/^\d{2}$/.test(id) || !/^[\w-]+$/.test(projectId)) throw new Error('Invalid QA scope');
  const directory = join(stateDir, 'outputs', id); await mkdir(directory, {recursive:true,mode:0o700});
  const browser = await chromium.launch({headless:true,executablePath:process.env.GRUIA_CHROMIUM_EXECUTABLE ?? chromium.executablePath(),args:['--no-sandbox']});
  const issues: string[] = [];
  try {
    const context = await browser.newContext({storageState:join(stateDir,'browser-session.json'),locale:'es-ES'});
    const page = await context.newPage(); page.on('pageerror',(error: Error)=>issues.push('JavaScript: '+error.message.slice(0,250)));
    for (const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]] as const) {
      await page.setViewportSize({width,height});
      const response = await page.goto(`https://design.gruia.app/api/projects/${projectId}/raw/index.html`,{waitUntil:'load',timeout:60000});
      if (!response || response.status() !== 200) issues.push(`${name}: preview HTTP ${response?.status()}`);
      const result = await page.evaluate(()=>({
        title:document.title,heading:document.querySelector('h1')?.textContent?.trim(),text:document.body.innerText.length,
        overflow:document.documentElement.scrollWidth>innerWidth+2,
        sections:document.querySelectorAll('section,main article').length,
        controls:document.querySelectorAll('button,input,select').length,
        brokenAnchors:Array.from(document.querySelectorAll('a[href^="#"]')).map(a=>a.getAttribute('href')||'').filter(href=>href.length>1&&!document.getElementById(decodeURIComponent(href.slice(1))))
      }));
      if (!result.heading || result.text<1200) issues.push(`${name}: incomplete content`);
      if (result.overflow) issues.push(`${name}: horizontal overflow`);
      if (result.controls<3) issues.push(`${name}: insufficient interactive controls`);
      if (result.brokenAnchors.length) issues.push(`${name}: broken section links ${result.brokenAnchors.slice(0,8).join(',')}`);
      await page.screenshot({path:join(directory,name+'-hero.png'),fullPage:false,timeout:60000});
      await page.screenshot({path:join(directory,name+'.png'),fullPage:true,timeout:60000});
      await writeFile(join(directory,name+'.json'),JSON.stringify(result,null,2),{mode:0o600});
    }
  } catch (error) {issues.push(error instanceof Error?error.message:String(error));}
  finally {await browser.close();}
  const result={ok:issues.length===0,issues:[...new Set(issues)]};await writeFile(join(directory,'qa.json'),JSON.stringify(result,null,2),{mode:0o600});return result;
}
