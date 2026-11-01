import { describe, expect, it } from 'vitest';
import { officeImportReport } from './report';
import type { PictureOutcome } from './store-images';
import { SKIP_KINDS, addSkip, type SkipTally } from './tally';

describe('officeImportReport', () => {
  it('says nothing when everything came across', () => {
    const ok: PictureOutcome = { ok: true, imageId: 'a', width: 1, height: 1, kind: 'uploaded' };
    expect(officeImportReport({}, new Map([['a', ok]]), 'word')).toEqual([]);
  });

  it('counts failed images by reason, then each kind left out, in order', () => {
    const outcomes = new Map<string, PictureOutcome>([
      ['a', { ok: false, failure: 'gallery-full' }],
      ['b', { ok: false, failure: 'gallery-full' }],
      ['c', 'over-cap'],
      ['d', { ok: false, failure: 'unsupported' }],
    ]);
    const tally: SkipTally = {};
    addSkip(tally, 'tables', 2);
    addSkip(tally, 'footnotes');
    const lines = officeImportReport(tally, outcomes, 'word');
    expect(lines).toEqual([
      {
        title: 'Images',
        message:
          "1 image couldn't be saved: their format can't be shown in a browser (EMF, WMF or TIFF). It's an empty placeholder you can fill.",
      },
      {
        title: 'Images',
        message:
          "2 images couldn't be saved: your image gallery is full. They're empty placeholders you can fill.",
      },
      {
        title: 'Images',
        message:
          "1 image couldn't be saved: an import saves at most 100 images. It's an empty placeholder you can fill.",
      },
      {
        title: 'Tables',
        message: '2 tables were cut to fit: a table holds at most 500 rows and 20 columns.',
      },
      { title: 'Footnotes', message: '1 footnote was left out.' },
    ]);
  });

  it('has a line for every kind and every image reason, in both formats', () => {
    const tally = Object.fromEntries(SKIP_KINDS.map((k) => [k, 1])) as SkipTally;
    const reasons = [
      'missing-bytes',
      'too-large',
      'images-unavailable',
      'offline-budget',
      'upload-failed',
    ] as const;
    const outcomes = new Map<string, PictureOutcome>(
      reasons.map((f) => [f, { ok: false, failure: f }]),
    );
    for (const format of ['word', 'powerpoint'] as const) {
      const lines = officeImportReport(tally, outcomes, format);
      expect(lines).toHaveLength(SKIP_KINDS.length + reasons.length);
      for (const line of lines) expect(line.message).toMatch(/\.$/);
    }
    expect(officeImportReport({ tables: 3 }, new Map(), 'powerpoint')[0]!.message).toBe(
      '3 tables were left out.',
    );
    expect(officeImportReport({ shapes: 2 }, new Map(), 'powerpoint')[0]!.message).toBe(
      '2 shapes and lines without text were left out.',
    );
  });
});
