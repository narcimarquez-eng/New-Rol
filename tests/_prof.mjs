import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', '4178', '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('4178')) res(); }));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const block of [false, true]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  if (block) await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const t0 = Date.now();
  await page.goto('http://localhost:4178/?fixeddt', { waitUntil: 'commit' });
  await page.waitForFunction(() => window.__game && window.__game.zone, null, { timeout: 60000, polling: 50 });
  const ready = Date.now() - t0;
  const t = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), now: Math.round(performance.now()) }; });
  console.log(block ? 'sin fuentes' : 'con fuentes', 'ready', ready, t);
  await page.close();
}
await browser.close(); server.kill(); process.exit(0);
