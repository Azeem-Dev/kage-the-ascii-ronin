// Start Vite first. Optional argument: absolute path to an installed Playwright entry.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1866, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
async function sample(frames = 120) {
  return page.evaluate(async frames => {
    const times = []; let last = performance.now();
    for (let i = 0; i < frames; i++) {
      await new Promise(r => requestAnimationFrame(r));
      const now = performance.now(); times.push(now - last); last = now;
    }
    const sorted = [...times].sort((a, b) => a - b);
    return { fps: frames * 1000 / times.reduce((a, b) => a + b, 0), p95Ms: sorted[Math.floor(frames * .95)], maxMs: Math.max(...times), diagnostics: { ...document.querySelector('#world-canvas').dataset } };
  }, frames);
}
try {
  await page.goto('http://127.0.0.1:3000/');
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.time) > .2);
  await page.mouse.wheel(0, 4000);
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.zoom === '0.25');
  await sample(20); // Warm glyph/sprite caches before the steady-state comparison.
  const stationary = await sample();
  const grassBefore = await page.locator('canvas').evaluate(c => Array.from(c.getContext('2d').getImageData(12, 12, 40, 40).data));
  await sample(20);
  const grassAfter = await page.locator('canvas').evaluate(c => Array.from(c.getContext('2d').getImageData(12, 12, 40, 40).data));
  assert.deepEqual(grassAfter, grassBefore, 'Stationary ground texture flickers');
  assert(stationary.fps > 30, `Wide idle regression: ${stationary.fps.toFixed(1)} FPS`);
  const total = await page.locator('canvas').evaluate(c => c.width / 4 * (c.height / 6));
  assert(Number(stationary.diagnostics.changedCells) < total * .05, 'Idle frame redraws most cells');
  const startX = Number(stationary.diagnostics.playerX);
  await page.keyboard.down('KeyD');
  const moving = await sample();
  await page.keyboard.up('KeyD');
  assert(Number(moving.diagnostics.playerX) > startX + 1, 'Movement stopped');
  await page.screenshot({ path: 'artifacts/preview/optimized-wide-moving.png' });
  await page.mouse.wheel(0, -4000);
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.zoom === '5.00');
  await page.screenshot({ path: 'artifacts/preview/maximum-zoom.png' });
  await page.keyboard.press('KeyR');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.mounted === 'true');
  await page.screenshot({ path: 'artifacts/preview/riding.png' });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.mounted === 'false');
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => document.querySelector('#world-state')?.textContent?.includes('PAUSED'));
  const before = await page.locator('canvas').evaluate(c => c.toDataURL());
  await sample(20);
  assert.equal(await page.locator('canvas').evaluate(c => c.toDataURL()), before, 'Paused scene changes');
  assert.deepEqual(errors, []);
  const report = { viewport: [1866, 900], browser: await browser.version(), baselineBeforeOptimization: { fps: 5.493449, maxMs: 373.8, note: 'Same headless Chrome, viewport and zoom; 60 frames before caching/dirty-cell changes.' }, stationary, moving, checks: ['stable grass pixels', 'bounded idle dirty cells', 'movement', '0.25 and 5 zoom limits', 'mount/dismount', 'pause pixels', 'no page errors'] };
  await fs.writeFile('artifacts/preview/optimization-performance.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
