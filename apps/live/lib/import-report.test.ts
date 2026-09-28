import { describe, expect, it } from 'vitest';
import {
  IMPORT_NOTE_ORDER,
  attachPendingImages,
  ReportTally,
  describeImportNote,
  importSummaryLine,
  namesLine,
  reportHasNews,
} from './import-report';

describe('ReportTally', () => {
  it('returns only the kinds that occurred, in the spec order', () => {
    const tally = new ReportTally();
    tally.add('label-moved');
    tally.add('shape-unmatched', 2);
    tally.add('label-moved');
    tally.add('group-flattened', 0);
    expect(tally.notes()).toEqual([
      { kind: 'shape-unmatched', count: 2 },
      { kind: 'label-moved', count: 2 },
    ]);
  });

  it('tallies names, most frequent first, capped', () => {
    const tally = new ReportTally(2);
    for (const n of ['switch', 'router', 'router', 'hub', 'router', 'switch']) {
      tally.add('shape-unmatched');
      tally.name('shape-unmatched', n);
    }
    expect(tally.notes()[0]).toEqual({
      kind: 'shape-unmatched',
      count: 6,
      names: [
        { name: 'router', count: 3 },
        { name: 'switch', count: 2 },
      ],
      moreNames: 1,
    });
  });

  it('orders equal counts by name', () => {
    const tally = new ReportTally();
    tally.name('shape-unmatched', 'b');
    tally.name('shape-unmatched', 'a');
    tally.add('shape-unmatched', 2);
    expect(tally.notes()[0]!.names!.map((n) => n.name)).toEqual(['a', 'b']);
  });

  it('knows every kind in its order', () => {
    expect(new Set(IMPORT_NOTE_ORDER).size).toBe(IMPORT_NOTE_ORDER.length);
    expect(IMPORT_NOTE_ORDER[0]).toBe('shape-unmatched');
  });
});

describe('describeImportNote', () => {
  it('writes singular and plural copy', () => {
    expect(describeImportNote({ kind: 'shape-unmatched', count: 1 })).toBe(
      '1 shape had no livediagram match and came in as a labelled box.',
    );
    expect(describeImportNote({ kind: 'shape-unmatched', count: 3 })).toBe(
      '3 shapes had no livediagram match and came in as labelled boxes.',
    );
    expect(describeImportNote({ kind: 'image-placeholder', count: 2 })).toBe(
      '2 images came in as placeholders. Select one and upload the picture to fill it.',
    );
  });

  it('has copy for every kind', () => {
    for (const kind of IMPORT_NOTE_ORDER) {
      expect(describeImportNote({ kind, count: 2 })).toMatch(/^2 /);
    }
  });
});

describe('namesLine', () => {
  it('lists names with counts and an ellipsis when some are left out', () => {
    expect(
      namesLine({
        kind: 'shape-unmatched',
        count: 5,
        names: [
          { name: 'router', count: 3 },
          { name: 'hub', count: 1 },
        ],
        moreNames: 1,
      }),
    ).toBe('router ×3, hub, …');
    expect(namesLine({ kind: 'label-moved', count: 1 })).toBeNull();
  });
});

describe('importSummaryLine', () => {
  it('describes a single page and several', () => {
    expect(importSummaryLine({ source: 'drawio', pages: 1, elements: 1, notes: [] })).toBe(
      'Imported 1 element.',
    );
    expect(importSummaryLine({ source: 'drawio', pages: 3, elements: 128, notes: [] })).toBe(
      '3 pages became 3 tabs, 128 elements.',
    );
  });
});

describe('attachPendingImages', () => {
  it('places nothing until the image pipeline lands', async () => {
    const pages = [{ tabId: 't', elements: [] }];
    expect(
      await attachPendingImages(pages, [
        {
          tabId: 't',
          elementId: 'e',
          key: 'k',
          source: { kind: 'data-url', dataUrl: 'data:image/png;base64,AA==' },
          hint: { width: 1, height: 1 },
        },
      ]),
    ).toEqual({ pages, placed: 0 });
  });
});

describe('reportHasNews', () => {
  const base = { source: 'drawio' as const, pages: 1, elements: 3, notes: [] };
  it('is true when anything changed or any image was met', () => {
    expect(reportHasNews(base)).toBe(false);
    expect(reportHasNews({ ...base, notes: [{ kind: 'label-moved', count: 1 }] })).toBe(true);
    expect(
      reportHasNews({ ...base, images: { imported: 0, deduped: 0, placeholders: {} } }),
    ).toBe(false);
    expect(
      reportHasNews({ ...base, images: { imported: 1, deduped: 0, placeholders: {} } }),
    ).toBe(true);
  });
});
