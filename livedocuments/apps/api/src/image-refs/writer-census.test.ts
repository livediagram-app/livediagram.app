import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every writer of `tabs` must keep `image_refs` in step
// (docs/specs/009-elements/images.md, "Reference index"): a writer that
// doesn't is how a placed image gets reaped. This census fails the moment SQL
// writing `tabs` appears somewhere new, so the author has to wire the index
// (and its test in db/image-refs-writers.test.ts) before the count is raised.

const APPS = fileURLToPath(new URL('../../../', import.meta.url).href);

const WRITES_TABS =
  /\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO|DROP\s+TABLE)\s+tabs\b/gi;

// file -> number of statements writing `tabs`, each one proven in
// db/image-refs-writers.test.ts.
const KNOWN_WRITERS: Record<string, number> = {
  // tabWriteStatements (upsertTab, upsertTabAtRev), seedTabs, deleteTabRow, swapTabData; and
  // renameTab, which writes the name, never `data`, so it has no image reference to keep.
  'api/src/db/tabs.ts': 5,
  // importDocumentCopy (a copy lands in its new document's own store)
  'api/src/document-room/document-content.ts': 1,
  // anonymiseDocument: a closed account's name off the comments in a body; it changes no image id, so the body's
  // references stay as they were.
  'api/src/document-room/document-anonymise.ts': 1,
  // The test database's stand-in for a document's purge (its object deletes everything it stores); the
  // references go with the tabs by their foreign key.
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
