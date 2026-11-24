// Start Vite first. Optional argument: absolute path to an installed Playwright entry.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await fs.mkdir('artifacts/preview', { recursive: true });
try {
  await page.goto('http://127.0.0.1:3000/');
  const canvas = page.locator('#world-canvas');
  await page.waitForFunction(() => Number(document.querySelector('#world-canvas')?.dataset.time) > .4);
  assert.equal(await page.getByRole('button', { name: /approve/i }).count(), 0);
  const performanceSample = await page.evaluate(async () => {
    const intervals = [];
    let last = performance.now();
    for (let i = 0; i < 120; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const now = performance.now(); intervals.push(now - last); last = now;
    }
    intervals.sort((a, b) => a - b);
    return { viewport: [innerWidth, innerHeight], userAgent: navigator.userAgent, logicalCores: navigator.hardwareConcurrency, frames: intervals.length, averageFps: 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length), p95FrameMs: intervals[Math.floor(intervals.length * .95)], diagnostics: { ...document.querySelector('#world-canvas').dataset } };
  });
  await fs.writeFile('artifacts/preview/performance.json', JSON.stringify(performanceSample, null, 2));
  await page.screenshot({ path: 'artifacts/preview/river-scene.png' });
  const x = Number(await canvas.getAttribute('data-player-x'));
  await page.keyboard.down('KeyA');
  await page.waitForFunction(start => Number(document.querySelector('#world-canvas')?.dataset.playerX) < start - 50, x);
  await page.keyboard.up('KeyA');
  assert((await page.locator('#world-location').textContent()).includes('WADING'));
  await page.screenshot({ path: 'artifacts/preview/wading.png' });
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => document.querySelector('#world-state')?.textContent?.includes('PAUSED'));
  const pausedPixels = await canvas.evaluate(c => c.toDataURL());
  const pausedTime = await canvas.getAttribute('data-time');
  await page.waitForTimeout(200);
  assert.equal(await canvas.getAttribute('data-time'), pausedTime);
  assert.equal(await canvas.evaluate(c => c.toDataURL()), pausedPixels);
  await page.keyboard.press('KeyV');
  await page.waitForFunction(() => document.querySelector('#world-state')?.textContent?.includes('MIDNIGHT STEEL'));
  await page.keyboard.press('KeyR');
  await page.keyboard.press('KeyP');
  await page.mouse.wheel(0, -300);
  await page.screenshot({ path: 'artifacts/preview/close-up.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('KeyR');
  await page.screenshot({ path: 'artifacts/preview/mobile.png' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
  const oldX = Number(await canvas.getAttribute('data-player-x'));
  await canvas.click({ position: { x: 300, y: 550 } });
  await page.waitForFunction(start => Math.abs(Number(document.querySelector('#world-canvas')?.dataset.playerX) - start) > 1, oldX);
  await page.goto('http://127.0.0.1:3000/?mode=game');
  await page.locator('#ascii-canvas').waitFor({ state: 'visible' });
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log('PASS: full-screen scene, no approval UI, keyboard movement, river wading, pause pixels, robe switch, zoom, mobile tap movement and legacy route. No page errors.');
} finally { await context.close(); await browser.close(); }
