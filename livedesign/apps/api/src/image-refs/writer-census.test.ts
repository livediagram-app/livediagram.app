import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every writer of `tabs` must keep `image_refs` in step
// (docs/specs/009-elements/images.md, "Reference index"): a writer that
// doesn't is how a placed image reads as unplaced to the media service's sweep. This census fails the moment SQL
// writing `tabs` appears somewhere new, so the author has to wire the index
// (and its test in db/image-refs-writers.test.ts) before the count is raised. A design's schema changes
// (design-room/design-schema.ts) are source too, so they are counted here.

const APPS = fileURLToPath(new URL('../../../', import.meta.url).href);

const WRITES_TABS =
  /\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO|DROP\s+TABLE)\s+tabs\b/gi;

// file -> number of statements writing `tabs`, each one proven in
// db/image-refs-writers.test.ts.
const KNOWN_WRITERS: Record<string, number> = {
  // tabWriteStatements (upsertTab, upsertTabAtRev), seedTabs, deleteTabRow, swapTabData; and
  // stampTabElementCount and renameTab, which write element_count or the name, never `data`, so
  // they have no image reference to keep.
  'api/src/db/tabs.ts': 6,
  // importDesignCopy: the copy's tabs, with their references from the copied bodies.
  'api/src/design-room/design-content.ts': 1,
  // anonymiseDesign: rewrites a closed account's name in comments, never an image.
  'api/src/design-room/design-anonymise.ts': 1,
  // A shared tab's copies (docs/specs/006-design/tab-design-many-to-many.md): @liveworkspace/index-app takes one in
  // through tabWriteStatements (the app's insertTab), and a later body from another holder replaces the data in the
  // same batch as this file's bodyTaken, which stamps the element count and replaces its references.
  'api/src/design-room/tab-shares.ts': 1,
  // The test SQLite's purge of a design (a Durable Object's deleteAll in production).
  'api/src/test-sqlite-d1.ts': 1,
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('writers of tabs', () => {
  it('are exactly the known, index-maintaining ones', () => {
    const found: Record<string, number> = {};
    for (const app of readdirSync(APPS)) {
      const src = join(APPS, app, 'src');
      if (!statSync(join(APPS, app)).isDirectory()) continue;
      try {
        statSync(src);
      } catch {
        continue;
      }
      for (const file of sourceFiles(src)) {
        const n = readFileSync(file, 'utf8').match(WRITES_TABS)?.length ?? 0;
        if (n > 0) found[relative(APPS, file)] = n;
      }
    }
    expect(found).toEqual(KNOWN_WRITERS);
  });
});
