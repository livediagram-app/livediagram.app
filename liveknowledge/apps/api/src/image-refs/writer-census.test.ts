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
// The shared tab store's reads and writes (@liveworkspace/index-app), which db/tabs.ts binds.
const SHARED = fileURLToPath(new URL('../../../../../packages/', import.meta.url).href);
const SHARED_TAB_STORE = ['index-app/src/item-tab-reads.ts', 'index-app/src/item-tab-writes.ts'];

const WRITES_TABS =
  /\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO|DROP\s+TABLE)\s+tabs\b/gi;

// file -> number of statements writing `tabs`, each one proven in
// db/image-refs-writers.test.ts.
const KNOWN_WRITERS: Record<string, number> = {
  // The tab store every product binds (db/tabs.ts): tabWriteStatements (upsertTab, upsertTabAtRev), seedTabs,
  // deleteTabRow (its two forms) and swapTabData, each with the product's reference statements beside it; and
  // renameTab, which writes the name, never `data`.
  'index-app/src/item-tab-writes.ts': 6,
  // stampTabElementCount, which writes the count, never `data`.
  'index-app/src/item-tab-reads.ts': 1,
  // importDocumentCopy (a copy lands in its new document's own store)
  'api/src/document-room/document-content.ts': 1,
  // anonymiseDocument: a closed account's name off the comments in a body; it changes no image id, so the body's
  // references stay as they were.
  'api/src/document-room/document-anonymise.ts': 1,
  // A shared tab's copies (docs/specs/006-document/tab-document-many-to-many.md): @liveworkspace/index-app takes one in through
  // tabWriteStatements (the app's insertTab), and a later body from another holder replaces the data in the same
  // batch as this file's bodyTaken, which stamps the element count and replaces its references.
  'api/src/document-room/tab-shares.ts': 1,
  // writeTabParents (its two forms, set and remove): a moved page's `parent` written into its body by the metadata
  // save (docs/specs/030-knowledgebase/blueprints/page-tree.md "Storage"). It changes no element, so the body's
  // image references and its element count stay as they were.
  'api/src/document-room/page-tree-store.ts': 2,
  // writePageKnowledge (its two forms, set and remove): a page's knowledge fields written into its body by Verify
  // and the Page Health card (docs/specs/030-knowledgebase/verification.md). It changes no element, so the body's
  // image references and its element count stay as they were.
  'api/src/knowledge/page-knowledge.ts': 2,
  // dropStaleDrafts: a page's draft left 30 days (docs/specs/030-knowledgebase/editing.md "A draft that is left")
  // taken off its body by the daily upkeep. It adds no image; references only the draft placed stay until the page's
  // next save replaces the set, so an image is kept a little longer, never reaped early.
  'api/src/document-room/draft-upkeep.ts': 1,
  // The page Trash (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page Trash"): the purges, Delete
  // Forever and Empty Trash delete trashed tabs, whose references go with them by their foreign key; a restore at the
  // top level takes `$.parent` off a body, which changes no element.
  'api/src/document-room/page-trash.ts': 6,
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
    for (const file of SHARED_TAB_STORE) {
      const n = readFileSync(join(SHARED, file), 'utf8').match(WRITES_TABS)?.length ?? 0;
      if (n > 0) found[file] = n;
    }
    expect(found).toEqual(KNOWN_WRITERS);
  });
});
