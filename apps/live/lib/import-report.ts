// What an import changed on the way in (docs/specs/020-import-export/drawio-import.md
// "The import report"). Shared by every importer that can degrade: a closed
// set of kinds, a count each, and the copy the Import dialog's summary shows,
// so "nothing degrades silently" is one vocabulary rather than one per format.

import type { Element } from '@livediagram/diagram';
import { importImageReportTotal, type ImportImageReport } from './import-images';

export type ImportNoteKind =
  | 'shape-unmatched'
  | 'shape-approximated'
  | 'icon-substituted'
  | 'image-placeholder'
  | 'image-unavailable'
  | 'arrowhead-approximated'
  | 'connection-loosened'
  | 'label-moved'
  | 'lane-title-turned'
  | 'group-flattened'
  | 'hidden-skipped'
  | 'collapsed-skipped'
  | 'link-dropped'
  | 'text-truncated'
  | 'content-truncated';

/** The summary's order: the spec table's. */
export const IMPORT_NOTE_ORDER: readonly ImportNoteKind[] = [
  'shape-unmatched',
  'shape-approximated',
  'icon-substituted',
  'image-placeholder',
  'image-unavailable',
  'arrowhead-approximated',
  'connection-loosened',
  'label-moved',
  'lane-title-turned',
  'group-flattened',
  'hidden-skipped',
  'collapsed-skipped',
  'link-dropped',
  'text-truncated',
  'content-truncated',
];

export type ImportNote = {
  kind: ImportNoteKind;
  count: number;
  /** What the count is made of, most frequent first (unmatched stencils). */
  names?: { name: string; count: number }[];
  /** How many further names were left out of `names`. */
  moreNames?: number;
};

export type ImportSource = 'drawio' | 'excalidraw';

export type ImportReport = {
  source: ImportSource;
  pages: number;
  elements: number;
  notes: ImportNote[];
  /** How the images the import met came across (the import image pipeline's report). */
  images?: ImportImageReport;
};

/** Whether a finished import has anything to tell: a change on the way in, or
 *  images it met. A report without news closes the Import dialog. */
export function reportHasNews(report: ImportReport): boolean {
  return report.notes.length > 0 || (!!report.images && importImageReportTotal(report.images) > 0);
}

/** An embedded image an import could not store itself, shaped like the
 *  shared import image pipeline's request (plus the tab it lands on): the seam
 *  for that pipeline (docs/specs/020-import-export/drawio-import.md "Images").
 *  Requests sharing a `key` carry the same bytes and are stored once. */
export type PendingImage = {
  tabId: string;
  elementId: string;
  key: string;
  source: { kind: 'data-url'; dataUrl: string };
  hint: { width: number; height: number };
};

const DEFAULT_NAMES_MAX = 5;

export class ReportTally {
  readonly #counts = new Map<ImportNoteKind, number>();
  readonly #names = new Map<ImportNoteKind, Map<string, number>>();
  readonly #namesMax: number;

  constructor(namesMax = DEFAULT_NAMES_MAX) {
    this.#namesMax = namesMax;
  }

  add(kind: ImportNoteKind, count = 1): void {
    if (count <= 0) return;
    this.#counts.set(kind, (this.#counts.get(kind) ?? 0) + count);
  }

  name(kind: ImportNoteKind, name: string): void {
    const names = this.#names.get(kind) ?? new Map<string, number>();
    names.set(name, (names.get(name) ?? 0) + 1);
    this.#names.set(kind, names);
  }

  notes(): ImportNote[] {
    const out: ImportNote[] = [];
    for (const kind of IMPORT_NOTE_ORDER) {
      const count = this.#counts.get(kind) ?? 0;
      if (count === 0) continue;
      const note: ImportNote = { kind, count };
      const names = this.#names.get(kind);
      if (names && names.size > 0) {
        const sorted = [...names]
          .map(([name, n]) => ({ name, count: n }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
        note.names = sorted.slice(0, this.#namesMax);
        if (sorted.length > this.#namesMax) note.moreNames = sorted.length - this.#namesMax;
      }
      out.push(note);
    }
    return out;
  }
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function describeImportNote({ kind, count: n }: ImportNote): string {
  const s = (one: string, many: string) => `${n} ${plural(n, one, many)}`;
  switch (kind) {
    case 'shape-unmatched':
      return `${s('shape', 'shapes')} had no livediagram match and came in as ${plural(n, 'a labelled box', 'labelled boxes')}.`;
    case 'shape-approximated':
      return `${s('shape', 'shapes')} came in as the nearest livediagram shape.`;
    case 'icon-substituted':
      return `${s('vendor icon', 'vendor icons')} came in as the matching livediagram icon.`;
    case 'image-placeholder':
      return `${s('image', 'images')} came in as ${plural(n, 'a placeholder', 'placeholders')}. Select one and upload the picture to fill it.`;
    case 'image-unavailable':
      return `${s('image', 'images')} ${plural(n, 'links', 'link')} to files outside the diagram and came in as ${plural(n, 'a placeholder', 'placeholders')} or ${plural(n, 'was', 'were')} left out.`;
    case 'arrowhead-approximated':
      return `${s('connection uses', 'connections use')} arrowheads livediagram doesn't draw; ${plural(n, 'it has', 'they have')} the nearest one.`;
    case 'connection-loosened':
      return `${s('connection end', 'connection ends')} couldn't stay attached and ${plural(n, 'was', 'were')} left where ${plural(n, 'it was', 'they were')}.`;
    case 'label-moved':
      return `${s('label was', 'labels were')} moved inside ${plural(n, 'its shape', 'their shapes')} or merged onto one line.`;
    case 'lane-title-turned':
      return `${s('lane title', 'lane titles')} written upright in draw.io now ${plural(n, 'reads', 'read')} across; lanes grew to the left where a title needed the room.`;
    case 'group-flattened':
      return `${s('group was', 'groups were')} dropped; ${plural(n, 'its', 'their')} shapes kept their places.`;
    case 'hidden-skipped':
      return `${s('hidden item was', 'hidden items were')} left out.`;
    case 'collapsed-skipped':
      return `${s('item', 'items')} inside collapsed containers ${plural(n, 'was', 'were')} left out.`;
    case 'link-dropped':
      return `${s('link', 'links')} of a kind livediagram can't follow ${plural(n, 'was', 'were')} dropped.`;
    case 'text-truncated':
      return `${s('text was', 'texts were')} shortened to fit.`;
    case 'content-truncated':
      return `${s('page or item', 'pages or items')} beyond the import limits ${plural(n, 'was', 'were')} left out.`;
  }
}

/** "router ×3, switch, …", or null when the note carries no names. */
export function namesLine(note: ImportNote): string | null {
  if (!note.names || note.names.length === 0) return null;
  const parts = note.names.map((n) => (n.count > 1 ? `${n.name} ×${n.count}` : n.name));
  if (note.moreNames) parts.push('…');
  return parts.join(', ');
}

export function importSummaryLine({ pages, elements }: ImportReport): string {
  const items = `${elements} ${plural(elements, 'element', 'elements')}`;
  return pages > 1 ? `${pages} pages became ${pages} tabs, ${items}.` : `Imported ${items}.`;
}

/**
 * Store the images an import could not store itself and fill their
 * placeholders. The seam for the shared import image pipeline: until it lands,
 * nothing is stored and every placeholder stays (and stays counted). The
 * pipeline replaces this body with its session and `attachImportImages` per page.
 */
export async function attachPendingImages<P extends { tabId: string; elements: Element[] }>(
  pages: P[],
  images: PendingImage[],
): Promise<{ pages: P[]; placed: number }> {
  void images;
  return { pages, placed: 0 };
}
