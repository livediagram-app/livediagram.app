import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
// Its window globals' types; the harness itself runs in the page.
import type { ParityResult } from './photo-gpu-parity.harness';

// docs/specs/031-photo/blueprints/photo-engine.md "The GPU compositor": what the screen draws is what the
// export draws. The harness (photo-gpu-parity.harness.ts) composites each scenario on the GPU and on the CPU;
// every one must agree within a few levels. It once caught every second layer drawn upside down, adjustment
// layers drawn as nothing and hard pixel edges never drawn.

// Threshold adjustments and Hard Mix may part a level on half-transparent pixels: the GPU keeps tiles
// premultiplied in 8 bits, so such a pixel's colour can land either side of the threshold. A handful each.
const THRESHOLD_GIVE: Record<string, number> = {
  'blend hard-mix': 12,
  'adjust posterize': 12,
  'adjust threshold': 12,
};

test('the GPU compositor draws what the CPU composite does', async ({ page }) => {
  const entry = fileURLToPath(new URL('./photo-gpu-parity.harness.ts', import.meta.url));
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    write: false,
    logLevel: 'silent',
    alias: { '@': fileURLToPath(new URL('..', import.meta.url)) },
  });
  await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
  await page.addScriptTag({ content: out.outputFiles[0]!.text });
  const gpu = await page.evaluate(() => window.hasWebGl2());
  test.skip(!gpu, 'This browser has no WebGL 2: the CPU view draws instead.');
  const results = await page.evaluate(() =>
    (
      window as unknown as { runParity: () => { name: string; bad: number; glError: number }[] }
    ).runParity(),
  );
  const views = await page.evaluate(() =>
    (
      window as unknown as { runViews: () => { name: string; bad: number; glError: number }[] }
    ).runViews(),
  );
  expect(results.length).toBeGreaterThan(60);
  const failing = ([...results, ...views] as ParityResult[]).filter(
    (r) => r.glError !== 0 || r.bad > (THRESHOLD_GIVE[r.name] ?? 0),
  );
  expect(failing).toEqual([]);
});
