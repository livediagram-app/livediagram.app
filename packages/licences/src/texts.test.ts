import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { normaliseText } from './licence-files.ts';
import { TEXT_SOURCES, TEXTS_DIR } from './texts.ts';

const onDisk = readdirSync(TEXTS_DIR).toSorted();

// The pool is shared; the tables naming its files are each product's (<product>/packages/licences/src),
// read here as text because this package cannot depend on them. Each product's own test checks that
// every file its tables name is in the pool.
const repo = fileURLToPath(new URL('../../../', import.meta.url));
// liveworkspace.app keeps its tables beside its site (liveworkspace/apps/site/lib/licences).
const tables = readdirSync(repo).flatMap((product) =>
  ['overrides.ts', 'embedded-works.ts']
    .flatMap((file) => [
      join(repo, product, 'packages/licences/src', file),
      join(repo, product, 'apps/site/lib/licences', file),
    ])
    .filter((path) => existsSync(path)),
);
const tableFiles = tables.flatMap((path) =>
  [...readFileSync(path, 'utf8').matchAll(/(?:file:\s*|text\(\s*)'([\w.-]+\.txt)'/g)].map(
    (m) => m[1]!,
  ),
);

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

  it('leaves no committed text unreferenced by the products’ tables', () => {
    expect(tables.length).toBeGreaterThanOrEqual(8);
    expect([...new Set(tableFiles)].toSorted()).toEqual(onDisk);
  });
});
