import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { WORK_DIR } from '../paths';
import { WEIGHTS_DIR } from './weights';

// What the boundary model costs in a BROWSER (experiment J4): the lazy chunk
// the photo import would load (TensorFlow.js core + layers + one backend,
// bundled and minified), its size raw / gzip / brotli, and the time from a
// 1000x563 ImageData to the class probabilities back in JavaScript, in
// headless Chromium, cold (first run: shaders compile) and warm (median of
// ten).
//
//   npx tsx scripts/hybrid/browser-bench.ts [--weights <dir>] [--backends webgl,webgpu,wasm,cpu]
//     [--gpu]   (ask Chromium for the real GPU; without it WebGL is SwiftShader)
//     [--isolated]  (cross-origin isolated page, so WASM may use threads)
//     [--npm <dir>]  (where @tensorflow/tfjs-backend-webgpu and -wasm are
//                     unpacked: they are not dependencies of this repo)
//
// Nothing is served on a port: every URL the page asks for is answered from
// disk by Playwright's router. The image is noise: speed does not depend on
// what is in the photo, and the photos stay private.

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1]!;
};
const weights = arg('weights', WEIGHTS_DIR);
const backends = arg('backends', 'webgl,webgpu,wasm,cpu').split(',');
const npmDir = arg('npm', `${WORK_DIR}/npm/node_modules`);
const gpu = process.argv.includes('--gpu');
// Cross-origin isolation (COOP + COEP) lets the WASM backend use threads.
const isolated = process.argv.includes('--isolated');

const repoRoot = resolve(import.meta.dirname, '../../../..');
const pnpmTfjs = `${repoRoot}/node_modules/.pnpm/@tensorflow+tfjs@4.22.0_seedrandom@3.0.5/node_modules`;
const require = createRequire(`${repoRoot}/node_modules/.pnpm/node_modules/`);
// Playwright is sticky-vision's (its sweep renders the editor's pixels with it).
const { chromium } = createRequire(`${repoRoot}/packages/sticky-vision/package.json`)(
  '@playwright/test',
) as { chromium: { launch(o: { args: string[] }): Promise<Browser> } };

// The little of Playwright used here, typed where this package can see it.
type Route = {
  request(): { url(): string };
  fulfill(o: {
    status?: number;
    contentType?: string;
    body: string | Buffer;
    headers?: Record<string, string>;
  }): Promise<void>;
};
type Page = {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  addInitScript(script: string): Promise<void>;
  goto(url: string): Promise<unknown>;
  addScriptTag(o: { url: string }): Promise<unknown>;
  evaluate<R, A>(fn: (arg: A) => Promise<R>, arg: A): Promise<R>;
  close(): Promise<void>;
};
type Browser = { newPage(): Promise<Page>; version(): string; close(): Promise<void> };

// The little of TensorFlow.js the page uses (the bundle's, not this package's).
type Tensor = { dispose(): void; data(): Promise<unknown> };
type Tf = {
  setBackend(name: string): Promise<boolean>;
  ready(): Promise<void>;
  getBackend(): string;
  tidy<T>(fn: () => T): T;
  browser: { fromPixels(image: ImageData): Tensor };
  cast(x: Tensor, dtype: 'float32'): Tensor;
  div(x: Tensor, y: number): Tensor;
  pad(x: Tensor, paddings: [number, number][]): Tensor;
  expandDims(x: Tensor, axis: number): Tensor;
  slice(x: Tensor, begin: number[], size: number[]): Tensor;
};
const esbuild = require(`${repoRoot}/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild`) as {
  build: (o: Record<string, unknown>) => Promise<{ outputFiles: { contents: Uint8Array }[] }>;
};

const BACKEND_MODULE: Record<string, string> = {
  webgl: '@tensorflow/tfjs-backend-webgl',
  webgpu: '@tensorflow/tfjs-backend-webgpu',
  wasm: '@tensorflow/tfjs-backend-wasm',
  cpu: '@tensorflow/tfjs-backend-cpu',
};

async function bundle(backend: string): Promise<string> {
  const entry = `
    import * as tf from '@tensorflow/tfjs-core';
    import { loadLayersModel } from '@tensorflow/tfjs-layers';
    import * as backend from '${BACKEND_MODULE[backend]}';
    window.bench = { tf, loadLayersModel, backend };`;
  const out = await esbuild.build({
    stdin: { contents: entry, resolveDir: repoRoot, loader: 'js' },
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2020',
    write: false,
    nodePaths: [pnpmTfjs, npmDir],
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
  });
  return new TextDecoder().decode(out.outputFiles[0]!.contents);
}

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
const files = new Map<string, Buffer>([
  ['model.json', readFileSync(`${weights}/model.json`)],
  ['weights.bin', readFileSync(`${weights}/weights.bin`)],
]);
const wasmDist = `${npmDir}/@tensorflow/tfjs-backend-wasm/dist`;
if (existsSync(wasmDist)) {
  for (const f of [
    'tfjs-backend-wasm.wasm',
    'tfjs-backend-wasm-simd.wasm',
    'tfjs-backend-wasm-threaded-simd.wasm',
  ]) {
    files.set(f, readFileSync(`${wasmDist}/${f}`));
  }
}

const browser = await chromium.launch({
  args: gpu
    ? [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--use-angle=vulkan',
        '--enable-features=Vulkan',
      ]
    : ['--enable-unsafe-webgpu'],
});
console.log(
  `weights ${weights}: ${kb(files.get('weights.bin')!.length)}  chromium ${browser.version()}  ${gpu ? 'GPU asked for' : 'default flags'}`,
);
for (const backend of backends) {
  let js: string;
  try {
    js = await bundle(backend);
  } catch (err) {
    console.log(`${backend.padEnd(7)} no bundle: ${String(err).split('\n')[0]}`);
    continue;
  }
  const size = `${kb(js.length)} min, ${kb(gzipSync(js).length)} gzip, ${kb(brotliCompressSync(js).length)} br`;
  const page = await browser.newPage();
  // tsx names every function it compiles with a `__name` helper; the
  // function handed to the page is serialised without it.
  await page.addInitScript('window.__name = (f) => f');
  await page.route('https://bench.local/**', (route) => {
    const name = route.request().url().split('/').pop()!;
    if (name === 'index.html')
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>bench</title>',
        headers: isolated
          ? {
              'Cross-Origin-Opener-Policy': 'same-origin',
              'Cross-Origin-Embedder-Policy': 'require-corp',
            }
          : {},
      });
    if (name === 'bundle.js') return route.fulfill({ contentType: 'text/javascript', body: js });
    const body = files.get(name);
    if (!body) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      contentType: name.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
      body,
    });
  });
  await page.goto('https://bench.local/index.html');
  await page.addScriptTag({ url: 'https://bench.local/bundle.js' });
  const result = await page.evaluate(async (name) => {
    const { tf, loadLayersModel, backend } = (
      window as unknown as {
        bench: {
          tf: Tf;
          loadLayersModel: (u: string) => Promise<{ predict: (x: unknown) => unknown }>;
          backend: { setWasmPaths?: (p: string) => void };
        };
      }
    ).bench;
    backend.setWasmPaths?.('https://bench.local/');
    let device = '';
    if (name === 'webgl') {
      const gl = document.createElement('canvas').getContext('webgl2');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      device = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'no webgl2';
    }
    if (name === 'webgpu') {
      const gpu = (
        navigator as unknown as {
          gpu?: {
            requestAdapter: () => Promise<{
              info?: { vendor: string; architecture: string; description: string };
            } | null>;
          };
        }
      ).gpu;
      const adapter = gpu ? await gpu.requestAdapter() : null;
      device = adapter
        ? `${adapter.info?.vendor} ${adapter.info?.architecture} ${adapter.info?.description}`.trim()
        : 'no adapter';
    }
    try {
      if (!(await tf.setBackend(name))) return { error: `setBackend(${name}) failed`, device };
      await tf.ready();
    } catch (err) {
      return { error: String(err), device };
    }
    const t0 = performance.now();
    const model = await loadLayersModel('https://bench.local/model.json');
    const loadMs = performance.now() - t0;
    const width = 1000;
    const height = 563;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 7919) % 256;
    const image = new ImageData(pixels, width, height);
    // The same steps as the node path: to floats in 0..1, padded to the
    // network's stride of 16, predicted, cropped back, read into JavaScript.
    const once = async () => {
      const start = performance.now();
      const out = tf.tidy(() => {
        const x = tf.div(tf.cast(tf.browser.fromPixels(image), 'float32'), 255);
        const padded = tf.pad(x, [
          [0, Math.ceil(height / 16) * 16 - height],
          [0, Math.ceil(width / 16) * 16 - width],
          [0, 0],
        ]);
        const y = model.predict(tf.expandDims(padded, 0)) as Tensor;
        return tf.slice(y, [0, 0, 0, 0], [1, height, width, 3]);
      });
      await out.data();
      out.dispose();
      return performance.now() - start;
    };
    const cold = await once();
    const runs: number[] = [];
    for (let i = 0; i < 10; i += 1) runs.push(await once());
    runs.sort((a, b) => a - b);
    if (name === 'wasm') device = `threads: ${crossOriginIsolated ? 'yes' : 'no'}`;
    return { device, loadMs, cold, warm: runs[5]!, min: runs[0]!, backend: tf.getBackend() };
  }, backend);
  await page.close();
  if ('error' in result) {
    console.log(`${backend.padEnd(7)} ${size}  ${result.device}  FAILED: ${result.error}`);
    continue;
  }
  console.log(
    `${backend.padEnd(7)} ${size}  load ${result.loadMs.toFixed(0)} ms  cold ${result.cold.toFixed(0)} ms` +
      `  warm ${result.warm.toFixed(0)} ms (min ${result.min.toFixed(0)})  ${result.device}`,
  );
}
await browser.close();
