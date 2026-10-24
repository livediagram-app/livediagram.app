import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { isLicenceAllowed } from '@liveworkspace/licences/licence-id';
import { TEXT_SOURCES } from '@liveworkspace/licences/texts';

import { EMBEDDED_WORKS } from './embedded-works.ts';
import { OVERRIDES } from './overrides.ts';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const tableFiles = [...OVERRIDES, ...EMBEDDED_WORKS]
  .flatMap((entry) => entry.texts)
  .flatMap((ref) => ('file' in ref ? [ref.file] : []));

// The texts themselves are the monorepo's one pool (@liveworkspace/licences, whose own test checks
// their checksums and that every one is named by some product).
describe('the tables', () => {
  it('name only texts in the shared pool', () => {
    const pool = new Set(TEXT_SOURCES.map((t) => t.file));
    for (const file of tableFiles) expect(pool.has(file), file).toBe(true);
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
    ['dd4dd8881e2df4e64203b5c0ae65e1648ab55207-index_bg.wasm', ['resvg', 'tiny-skia']],
    ['7237d9cf55f177702066a28a4dde1e4c7e8ab576-Inter-Regular.ttf', ['inter']],
    ['0f3a9c2e5d71b8a4c6e2f0d9b3a7c5e1f8d2b6a4-Inter-Bold.otf', ['inter']],
  ])('covers %s', (asset, ids) => {
    const hits = EMBEDDED_WORKS.filter(
      (w) => 'assets' in w.trigger && w.trigger.assets.test(asset),
    ).map((w) => w.id);
    for (const id of ids) expect(hits).toContain(id);
  });
});
