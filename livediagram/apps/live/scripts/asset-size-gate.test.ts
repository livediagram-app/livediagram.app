import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_ASSET_BYTES, oversizedAssets } from './asset-size-gate.mjs';

// Cloudflare Workers Static Assets refuses any file over 25 MiB, and only at
// deploy: transformers 4.3.0's 25.6 MiB onnxruntime wasm built and tested
// green, then failed every staging deploy. The gate moves that to the build.
describe('oversizedAssets', () => {
  let dir: string | null = null;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
  });

  function tree(files: Record<string, number>): string {
    const root = mkdtempSync(join(tmpdir(), 'asset-gate-'));
    dir = root;
    for (const [path, size] of Object.entries(files)) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), Buffer.alloc(size));
    }
    return root;
  }

  it("holds Cloudflare's 25 MiB per-file limit", () => {
    expect(MAX_ASSET_BYTES).toBe(25 * 1024 * 1024);
  });

  it('passes a tree whose files all fit, including one exactly at the limit', () => {
    const root = tree({ 'index.html': 10, '_next/static/media/a.wasm': 2048 });
    expect(oversizedAssets(root, 2048)).toEqual([]);
  });

  it('names every file over the limit, however deep, with its size', () => {
    const root = tree({
      'ok.js': 100,
      '_next/static/media/ort.asyncify.wasm': 2049,
      'deep/er/big.bin': 4096,
    });
    expect(oversizedAssets(root, 2048)).toEqual([
      { path: '_next/static/media/ort.asyncify.wasm', bytes: 2049 },
      { path: 'deep/er/big.bin', bytes: 4096 },
    ]);
  });
});
