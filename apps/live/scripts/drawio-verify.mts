// Real draw.io files through the importer, as the Explorer reads them
// (docs/specs/020-import-export/blueprints/drawio-import.md "Testing").
//
// A script, not a test: real diagrams are personal content and never fixtures. It reads every file
// under the paths it is given (files or folders) and prints only aggregates (the kind found, pages,
// counts per element type, note kinds with counts, tab sizes, validity, timing), never labels,
// names, ids, stencil names or coordinates, so its output is safe to share. Refusals print with any
// quoted part (a page name) masked.
//
//   pnpm --filter @livediagram/live exec tsx scripts/drawio-verify.mts <file or folder> [...]
//
// Exits non-zero when a file crashes the reader, or any element is invalid.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { MAX_TAB_BYTES, tabDataBytes } from '@livediagram/api-schema';
import { isValidElement, type Element } from '@livediagram/document';

// The importer's own logs may carry a cause quoting the file: only their fingerprints print.
for (const level of ['debug', 'info', 'warn'] as const) {
  console[level] = (fingerprint: unknown) => process.stderr.write(`${String(fingerprint)}\n`);
}

// The importer parses XML and HTML labels with the browser's DOMParser.
const dom = new JSDOM('');
const { DOMParser, Node, Element, HTMLElement, NodeFilter, XMLSerializer } = dom.window;
Object.assign(globalThis, { DOMParser, Node, Element, HTMLElement, NodeFilter, XMLSerializer });

const { readDrawioFiles } = await import('../lib/drawio/files');
const { sniffDrawio } = await import('../lib/drawio/envelope');

const countBy = <T,>(items: T[], key: (t: T) => string) => {
  const out: Record<string, number> = {};
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
  return out;
};
const notes = (report: { notes: { kind: string; count: number }[] }) =>
  Object.fromEntries(report.notes.map((n) => [n.kind, n.count]));
const masked = (message: string) => message.replace(/'[^']*'/g, "'…'");
// The kind of name a file has, never the name: Drive saves have none.
const extensionOf = (name: string) => {
  const m = /(\.drawio\.(?:png|svg)|\.[a-z0-9]{1,8})$/i.exec(name);
  return m ? m[1]!.toLowerCase() : 'none';
};

function filesUnder(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path)
    .sort()
    .flatMap((child) => filesUnder(join(path, child)));
}

const paths = process.argv.slice(2).flatMap(filesUnder);
if (paths.length === 0) {
  console.error('usage: drawio-verify.mts <file or folder> [...]');
  process.exit(2);
}

let failed = false;
const totals = { files: 0, diagrams: 0, libraries: 0, refused: 0, invalid: 0, oversizedTabs: 0 };
for (const [i, path] of paths.entries()) {
  const label = `input ${i + 1}`;
  const bytes = readFileSync(path);
  const file = new File([new Uint8Array(bytes)], path.split('/').pop()!, {
    lastModified: statSync(path).mtimeMs,
  });
  totals.files++;
  const started = performance.now();
  try {
    const sniffed = sniffDrawio({ kind: 'bytes', bytes: new Uint8Array(bytes) });
    const read = await readDrawioFiles([file]);
    const ms = Math.round(performance.now() - started);
    const base = { extension: extensionOf(file.name), sniffed, bytes: bytes.length, ms };
    for (const failure of read.failures) {
      totals.refused++;
      console.log(label, 'REFUSED', base, masked(failure.message));
    }
    for (const diagram of read.diagrams) {
      totals.diagrams++;
      const elements: Element[] = diagram.pages.flatMap((p) => p.elements);
      const invalid = elements.filter((el) => !isValidElement(el)).length;
      const tabBytes = diagram.pages.map((p) =>
        tabDataBytes({ elements: p.elements, layers: p.layers ?? [] }),
      );
      const oversized = tabBytes.filter((b) => b > MAX_TAB_BYTES).length;
      totals.invalid += invalid;
      totals.oversizedTabs += oversized;
      if (invalid > 0) failed = true;
      console.log(label, 'DIAGRAM', {
        ...base,
        pages: diagram.pages.length,
        emptyPages: diagram.pages.filter((p) => p.elements.length === 0).length,
        elementsPerPage: diagram.pages.map((p) => p.elements.length),
        types: countBy(elements, (el) => el.type),
        pinnedArrowEnds: elements
          .filter((el) => el.type === 'arrow')
          .flatMap((el) => [el.from, el.to])
          .filter((end) => end.kind === 'pinned').length,
        images: diagram.images.length,
        dated: diagram.modifiedAt ? 'yes' : 'no',
        named: diagram.name.startsWith('draw.io diagram') ? 'fallback' : 'from file',
        largestTabBytes: Math.max(0, ...tabBytes),
        oversizedTabs: oversized,
        invalid,
        notes: notes(diagram.report),
      });
    }
    for (const library of read.libraries) {
      totals.libraries++;
      const elements = library.items.flatMap((it) => it.elements);
      const invalid = elements.filter((el) => !isValidElement(el)).length;
      totals.invalid += invalid;
      if (invalid > 0) failed = true;
      console.log(label, 'LIBRARY', {
        ...base,
        items: library.items.length,
        untitled: library.items.filter((it) => !it.title).length,
        elementsPerItem: countBy(library.items, (it) => String(it.elements.length)),
        types: countBy(elements, (el) => el.type),
        images: library.images.length,
        itemsBytes: new TextEncoder().encode(JSON.stringify(library.items)).length,
        fitsOneRow: new TextEncoder().encode(JSON.stringify(library.items)).length <= MAX_TAB_BYTES,
        invalid,
        notes: notes(library.report),
      });
    }
  } catch (error) {
    failed = true;
    console.log(label, 'CRASHED', error instanceof Error ? error.name : 'unknown');
  }
}
console.log('totals', totals);
process.exit(failed ? 1 : 0);
