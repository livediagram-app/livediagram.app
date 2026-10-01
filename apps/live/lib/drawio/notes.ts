// What a draw.io import changed on the way in (docs/specs/020-import-export/drawio-import.md "The
// import report"): a closed set of note kinds, a count each, and for unmatched stencils their names.
// report.ts turns the notes into the one import report every importer shares.

export type ImportNoteKind =
  | 'shape-unmatched'
  | 'shape-approximated'
  | 'icon-substituted'
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

/** What one draw.io import made, and the notes of what changed on the way in. */
export type DrawioReport = {
  pages: number;
  elements: number;
  notes: ImportNote[];
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
