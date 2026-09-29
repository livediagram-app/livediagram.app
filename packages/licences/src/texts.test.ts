import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EMBEDDED_WORKS } from './embedded-works.ts';
import { isLicenceAllowed } from './licence-id.ts';
import { normaliseText } from './licence-files.ts';
import { OVERRIDES } from './overrides.ts';
import { TEXT_SOURCES, TEXTS_DIR } from './texts.ts';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const onDisk = readdirSync(TEXTS_DIR).toSorted();
const tableFiles = [...OVERRIDES, ...EMBEDDED_WORKS]
  .flatMap((entry) => entry.texts)
  .flatMap((ref) => ('file' in ref ? [ref.file] : []));

describe('TEXT_SOURCES', () => {
  it('lists every committed text exactly once', () => {
    expect(TEXT_SOURCES.map((t) => t.file).toSorted()).toEqual(onDisk);
  });

  it.each(TEXT_SOURCES.map((t) => [t.file, t] as const))(
    '%s matches its recorded checksum and is stored normalised',
    (_, source) => {
      const text = readFileSync(`${TEXTS_DIR}${source.file}`, 'utf8');
      expect(createHash('sha256').update(text).digest('hex')).toBe(source.sha256);
      expect(normaliseText(text)).toBe(text);
    },
  );

  it('names a pinned https source for every text', () => {
    for (const { file, sources } of TEXT_SOURCES) {
      expect(sources.length, file).toBeGreaterThan(0);
      for (const url of sources) expect(url, file).toMatch(/^https:\/\//);
    }
  });

  it('leaves no committed text unreferenced by a table', () => {
    expect([...new Set(tableFiles)].toSorted()).toEqual(onDisk);
  });
});

describe('OVERRIDES', () => {
  it('holds one entry per exact package version', () => {
    const keys = OVERRIDES.map((o) => `${o.package}@${o.version}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const o of OVERRIDES) expect(o.version, o.package).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('gives every override a text and an allowed licence when it sets one', () => {
    for (const o of OVERRIDES) {
      expect(o.texts.length, o.package).toBeGreaterThan(0);
      if (o.licence) expect(isLicenceAllowed(o.licence), o.package).toBe(true);
    }
  });
});

describe('EMBEDDED_WORKS', () => {
  it('has unique ids, texts, https homepages and allowed licences', () => {
    const ids = EMBEDDED_WORKS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const work of EMBEDDED_WORKS) {
      expect(work.texts.length, work.id).toBeGreaterThan(0);
      expect(work.homepage, work.id).toMatch(/^https:\/\//);
      expect(isLicenceAllowed(work.licence), work.id).toBe(true);
    }
  });

  it('triggers on source files that exist', () => {
    for (const work of EMBEDDED_WORKS) {
      if ('sources' in work.trigger) {
        for (const path of work.trigger.sources) {
          expect(existsSync(`${repoRoot}${path}`), `${work.id}: ${path}`).toBe(true);
        }
      }
    }
  });

  // The emitted names these entries must cover, as the bundlers write them.
  it.each([
    ['tfjs-backend-wasm.38dtokxvvg789.wasm', ['xnnpack', 'emscripten']],
    ['tfjs-backend-wasm-simd.3qlltfrj4oad9.wasm', ['xnnpack', 'cpuinfo', 'pthreadpool']],
    ['tfjs-backend-wasm-threaded-simd.0brfufvrco1qv.wasm', ['fp16', 'fxdiv', 'psimd', 'clog']],
    ['ort-wasm-simd-threaded.jsep.1d4fxnu9gfd3p.wasm', ['onnxruntime', 'emscripten']],
    ['webp_enc_simd.0abc.wasm', ['libwebp', 'emscripten']],
    ['webp_dec.0abc.wasm', ['libwebp']],
    ['dd4dd8881e2df4e64203b5c0ae65e1648ab55207-index_bg.wasm', ['resvg', 'tiny-skia']],
    ['7237d9cf55f177702066a28a4dde1e4c7e8ab576-Inter-Regular.ttf', ['inter']],
  ])('covers %s', (asset, ids) => {
    const hits = EMBEDDED_WORKS.filter(
      (w) => 'assets' in w.trigger && w.trigger.assets.test(asset),
    ).map((w) => w.id);
    for (const id of ids) expect(hits).toContain(id);
  });
});
