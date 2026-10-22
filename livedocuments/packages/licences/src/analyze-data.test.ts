import { describe, expect, it } from 'vitest';

import { decodeAnalyzeData } from './analyze-data.ts';

// The shape Next 16's `experimental-analyze -o` writes: a 4-byte big-endian
// length, that many bytes of JSON, then binary the decoder ignores.
function analyzeData(json: unknown, trailer = new Uint8Array([1, 2, 3])): Uint8Array {
  const body = new TextEncoder().encode(JSON.stringify(json));
  const out = new Uint8Array(4 + body.length + trailer.length);
  new DataView(out.buffer).setUint32(0, body.length);
  out.set(body, 4);
  out.set(trailer, 4 + body.length);
  return out;
}

const pnpmNext = '[project]/node_modules/.pnpm/next@16.3.6_react@19.3.0/node_modules/next/';

const sample = {
  sources: [
    { path: pnpmNext, parent_source_index: null },
    { parent_source_index: 0, path: 'dist/client/index.js' },
    { parent_source_index: 0, path: 'dist/server/render.js' },
    { path: '[project]/apps/live/app/page.tsx' },
    { path: '[turbopack]/browser/runtime.ts' },
    { path: '[project]/[client-fs]/_next/static/media/a.wasm' },
  ],
  chunk_parts: [
    { source_index: 1, output_file_index: 0 },
    { source_index: 2, output_file_index: 1 },
    { source_index: 3, output_file_index: 0 },
    { source_index: 4, output_file_index: 0 },
    { source_index: 5, output_file_index: 2 },
    { source_index: 1, output_file_index: 0 },
  ],
  output_files: [
    { filename: '[client-fs]/_next/static/chunks/abc.js' },
    { filename: '[output]/apps/live/.next-analyze/server/chunks/ssr/x.js' },
    { filename: '[client-fs]/_next/static/media/tfjs-backend-wasm.38dtokxvvg789.wasm' },
  ],
};

describe('decodeAnalyzeData', () => {
  it('keeps the repo files placed in client output, joined through their parents', () => {
    const { sources } = decodeAnalyzeData(analyzeData(sample));
    expect(sources).toEqual([
      'apps/live/app/page.tsx',
      'node_modules/.pnpm/next@16.3.6_react@19.3.0/node_modules/next/dist/client/index.js',
    ]);
  });

  it('drops server-only modules, bundler runtime and emitted-asset pseudo sources', () => {
    const { sources } = decodeAnalyzeData(analyzeData(sample));
    expect(sources.some((s) => s.includes('server/render'))).toBe(false);
    expect(sources.some((s) => s.startsWith('['))).toBe(false);
  });

  it('lists the basenames of every client output file as assets', () => {
    expect(decodeAnalyzeData(analyzeData(sample)).assets).toEqual([
      'abc.js',
      'tfjs-backend-wasm.38dtokxvvg789.wasm',
    ]);
  });

  it('refuses a buffer too short for its header', () => {
    expect(() => decodeAnalyzeData(new Uint8Array([0, 0]))).toThrow(/AnalyzeFormatUnrecognised/);
  });

  it('refuses a length that runs past the end', () => {
    const bytes = analyzeData(sample, new Uint8Array());
    new DataView(bytes.buffer).setUint32(0, bytes.length);
    expect(() => decodeAnalyzeData(bytes)).toThrow(/AnalyzeFormatUnrecognised.*length/);
  });

  it('refuses a body that is not JSON', () => {
    const bytes = new Uint8Array([0, 0, 0, 2, 123, 123]);
    expect(() => decodeAnalyzeData(bytes)).toThrow(/AnalyzeFormatUnrecognised.*JSON/);
  });

  it.each([
    ['a body that is not an object', null],
    ['missing sources', { ...sample, sources: undefined }],
    ['missing chunk parts', { ...sample, chunk_parts: 'x' }],
    ['missing output files', { ...sample, output_files: undefined }],
    ['a source without a path', { ...sample, sources: [{}] }],
    [
      'a source with a bad parent',
      { ...sample, sources: [{ path: 'a', parent_source_index: 'x' }] },
    ],
    ['an output file without a name', { ...sample, output_files: [{}] }],
    ['a chunk part without indices', { ...sample, chunk_parts: [{}] }],
    [
      'a chunk part naming no source',
      { ...sample, chunk_parts: [{ source_index: 99, output_file_index: 0 }] },
    ],
    [
      'a chunk part naming no output',
      { ...sample, chunk_parts: [{ source_index: 0, output_file_index: 99 }] },
    ],
    [
      'a parent out of range',
      {
        ...sample,
        sources: [{ path: 'a', parent_source_index: 9 }],
        chunk_parts: [{ source_index: 0, output_file_index: 0 }],
      },
    ],
    [
      'a parent cycle',
      {
        ...sample,
        sources: [{ path: 'a', parent_source_index: 0 }],
        chunk_parts: [{ source_index: 0, output_file_index: 0 }],
      },
    ],
  ])('refuses %s', (_, json) => {
    expect(() => decodeAnalyzeData(analyzeData(json))).toThrow(/AnalyzeFormatUnrecognised/);
  });

  it('names the parent fault it found', () => {
    const parts = [{ source_index: 0, output_file_index: 0 }];
    const cycle = {
      ...sample,
      sources: [{ path: 'a', parent_source_index: 0 }],
      chunk_parts: parts,
    };
    expect(() => decodeAnalyzeData(analyzeData(cycle))).toThrow(/cycle/);
    const range = {
      ...sample,
      sources: [{ path: 'a', parent_source_index: 9 }],
      chunk_parts: parts,
    };
    expect(() => decodeAnalyzeData(analyzeData(range))).toThrow(/out of range/);
  });
});
