// Visio import (docs/specs/020-import-export/visio-import.md): a .vsdx, saved from Visio or exported from
// Lucidchart, to one imported page per Visio page, plus the pending images and the report of what changed on the
// way in: the same result `importDrawio` returns, so the hook and the Explorer apply it the same way. Each page is
// built as draw.io's cell tree and converted by draw.io's own converter. Never throws.

import { convertPage } from '@/lib/drawio/convert-page';
import type { ImportedPage } from '@/lib/drawio/import';
import type { DrawioMeta } from '@/lib/drawio/envelope';
import { DRAWIO_MAX_PAGES, DRAWIO_REPORT_NAMES_MAX } from '@/lib/drawio/limits';
import { ReportTally, type DrawioReport } from '@/lib/drawio/notes';
import type { ImportImageRequest } from '@/lib/import-images';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { VISIO_DEFAULT_PAGE_HEIGHT_IN, VISIO_MAX_FILE_BYTES } from './limits';
import { readColourTable, readMasters, relIdOf } from './masters';
import { openVisioPackage, PAGES_PART, sniffVisio } from './package';
import { visioPageGraph } from './page';
import { VisioRefused, visioRefusalMessage } from './refusals';
import { ShapeSheet } from './sheet';
import { pageFrame } from './transform';

export type VisioImportResult =
  | {
      ok: true;
      pages: ImportedPage[];
      images: ImportImageRequest[];
      report: DrawioReport;
      meta: DrawioMeta;
    }
  | { ok: false; error: string };

type VisioImportOptions = {
  /** The tab id each page becomes, by page index. */
  tabIdForPage: (index: number) => string;
};

const childrenNamed = (el: Element | null | undefined, name: string) =>
  Array.from(el?.children ?? []).filter((c) => c.localName === name);

// Let the browser breathe between pages, so a many-page import does not hold input for its whole length.
const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function importVisio(
  bytes: Uint8Array<ArrayBuffer>,
  options: VisioImportOptions,
): Promise<VisioImportResult> {
  try {
    if (bytes.byteLength > VISIO_MAX_FILE_BYTES) throw new VisioRefused('too-large');
    const kind = sniffVisio(bytes);
    if (kind === 'vsd' || kind === 'vdx') throw new VisioRefused(kind);
    if (kind === null) throw new VisioRefused('not-visio');
    const pkg = openVisioPackage(bytes);
    const masters = await readMasters(pkg);
    const colours = await readColourTable(pkg);
    const pageEls = childrenNamed(await pkg.part(PAGES_PART), 'Page');
    if (pageEls.length === 0) throw new VisioRefused('no-pages');
    const rels = await pkg.rels(PAGES_PART);

    const tally = new ReportTally(DRAWIO_REPORT_NAMES_MAX);
    tally.add('content-truncated', Math.max(0, pageEls.length - DRAWIO_MAX_PAGES));
    const kept = pageEls.slice(0, DRAWIO_MAX_PAGES);
    const tabIds = kept.map((_, i) => options.tabIdForPage(i));
    const pageIdToTab = new Map(
      kept.map((p, i) => [p.getAttribute('ID') ?? `page-${i + 1}`, tabIds[i]!]),
    );
    const images: ImportImageRequest[] = [];
    const imageKeys = new Map<string, string>();
    const pages: ImportedPage[] = [];

    for (const [index, pageEl] of kept.entries()) {
      if (index > 0) await yieldToEventLoop();
      const pageSheet = childrenNamed(pageEl, 'PageSheet')[0];
      const height = pageSheet ? new ShapeSheet(pageSheet, null).num('PageHeight') : undefined;
      const relId = relIdOf(pageEl);
      const path = relId ? rels.get(relId) : undefined;
      const contents = path ? await pkg.part(path) : null;
      const graph = await visioPageGraph({
        contents,
        rels: path ? await pkg.rels(path) : new Map(),
        pkg,
        masters,
        colours,
        frame: pageFrame(
          height !== undefined && height > 0 ? height : VISIO_DEFAULT_PAGE_HEIGHT_IN,
        ),
        tally,
      });
      const converted = convertPage(graph, { tally, pageIdToTab, images, imageKeys });
      const name = pageEl.getAttribute('Name') ?? pageEl.getAttribute('NameU') ?? '';
      pages.push({ tabId: tabIds[index]!, name, ...converted });
      debugLog('[visio-import] page', {
        index,
        cells: graph.cells.size,
        elements: converted.elements.length,
      });
    }

    const report: DrawioReport = {
      pages: pages.length,
      elements: pages.reduce((n, p) => n + p.elements.length, 0),
      notes: tally.notes(),
    };
    return { ok: true, pages, images, report, meta: {} };
  } catch (error) {
    const refusal = error instanceof VisioRefused ? error : new VisioRefused('unreadable');
    console.warn('[visio-import] refused', {
      reason: refusal.reason,
      ...(error instanceof VisioRefused ? {} : { cause: String(error) }),
    });
    return { ok: false, error: visioRefusalMessage(refusal.reason) };
  }
}
