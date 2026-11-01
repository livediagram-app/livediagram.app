import { describe, expect, it, vi } from 'vitest';
import { articlesOf, pagesOf } from '@livedocuments/document';
import type { ImportImageSession } from '../import-images';
import { importOfficeFile, officeErrorMessage, tabBytes, type OfficeImportStage } from './index';
import { OfficeImportError, type OfficeImportFailure } from './errors';
import {
  asBlob,
  makeDocx,
  p,
  r,
  googleDocsSampleDocx,
  powerPointSampleDeck,
  wordSampleDocx,
} from './test-fixtures';

const session = (): ImportImageSession => ({
  store: vi.fn(async () => ({
    ok: true as const,
    imageId: 'img-1',
    width: 4,
    height: 3,
    kind: 'uploaded' as const,
  })),
});

const deps = (over: Partial<Parameters<typeof importOfficeFile>[2]> = {}) => ({
  tabName: 'Tab 1',
  offline: false,
  createSession: vi.fn(async () => session()),
  ...over,
});

describe('importOfficeFile', () => {
  it('imports a Word document as an article, with its report and stages', async () => {
    const stages: OfficeImportStage[] = [];
    const d = deps({ onStage: (s) => stages.push(s) });
    const result = await importOfficeFile(asBlob(await wordSampleDocx()), 'word', d);
    if (!result.ok) throw new Error(result.failure);
    expect(pagesOf(result.tab)[0]!.kind).toBe('article');
    expect(Object.keys(articlesOf(result.tab))).toHaveLength(1);
    expect(result.tab.elements).toHaveLength(1);
    expect(result.slides).toBeUndefined();
    expect(result.failures.map((f) => f.title)).toEqual([
      'Footnotes',
      'Comments',
      'Headers and footers',
      'Charts',
    ]);
    expect(stages).toEqual([
      { stage: 'reading' },
      { stage: 'images', done: 0, total: 1 },
      { stage: 'images', done: 1, total: 1 },
    ]);
    expect(d.createSession).toHaveBeenCalledTimes(1);
  });

  it('imports a Google Docs download', async () => {
    const result = await importOfficeFile(asBlob(await googleDocsSampleDocx()), 'word', deps());
    expect(result.ok && result.failures).toEqual([]);
  });

  it('imports a PowerPoint deck as slide pages with the deck details', async () => {
    const result = await importOfficeFile(
      asBlob(await powerPointSampleDeck()),
      'powerpoint',
      deps(),
    );
    if (!result.ok) throw new Error(result.failure);
    expect(pagesOf(result.tab).map((pg) => pg.kind)).toEqual(['slide', 'slide', 'slide']);
    expect(result.slides).toHaveLength(3);
    expect(result.slides!.map((s) => [!!s.notes, !!s.hidden])).toEqual([
      [true, false],
      [true, false],
      [false, true],
    ]);
  });

  it('makes no session for a file without pictures', async () => {
    const d = deps();
    const result = await importOfficeFile(
      asBlob(await makeDocx({ body: p(r('Just words')) })),
      'word',
      d,
    );
    expect(result.ok).toBe(true);
    expect(d.createSession).not.toHaveBeenCalled();
  });

  it('refuses a file over 50 MB without reading it', async () => {
    const big = { size: 51 * 1024 * 1024, arrayBuffer: vi.fn() } as unknown as Blob;
    expect(await importOfficeFile(big, 'word', deps())).toEqual({
      ok: false,
      failure: 'too-large',
    });
    expect(
      (big as unknown as { arrayBuffer: ReturnType<typeof vi.fn> }).arrayBuffer,
    ).not.toHaveBeenCalled();
  });

  it('names the failures of a wrong, broken or older file', async () => {
    expect(await importOfficeFile(asBlob(await wordSampleDocx()), 'powerpoint', deps())).toEqual({
      ok: false,
      failure: 'wrong-format',
    });
    expect(await importOfficeFile(new Blob(['nope']), 'word', deps())).toEqual({
      ok: false,
      failure: 'not-a-package',
    });
  });

  it('refuses a tab larger than a tab may be saved, unless the document is offline', async () => {
    const body = Array.from({ length: 120 }, () => p(r('y'.repeat(19_000)))).join('');
    const bytes = await makeDocx({ body });
    expect(await importOfficeFile(asBlob(bytes), 'word', deps())).toEqual({
      ok: false,
      failure: 'too-large-for-tab',
    });
    expect((await importOfficeFile(asBlob(bytes), 'word', deps({ offline: true }))).ok).toBe(true);
  });

  it('carries a reader’s count, and turns anything unexpected into not-a-package', async () => {
    const throwing = async () => {
      throw new OfficeImportError('too-many-slides', 140);
    };
    const failing = { size: 10, arrayBuffer: throwing } as unknown as Blob;
    expect(await importOfficeFile(failing, 'powerpoint', deps())).toEqual({
      ok: false,
      failure: 'too-many-slides',
      count: 140,
    });
    const odd = {
      size: 10,
      arrayBuffer: async () => {
        throw new Error('boom');
      },
    } as unknown as Blob;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await importOfficeFile(odd, 'word', deps())).toEqual({
      ok: false,
      failure: 'not-a-package',
    });
    warn.mockRestore();
  });

  it('measures a tab as UTF-8 JSON', () => {
    expect(tabBytes({ elements: [], pages: [], articles: {} })).toBe(
      '{"elements":[],"pages":[],"articles":{}}'.length,
    );
  });
});

describe('officeErrorMessage', () => {
  it('has a message for every failure, worded for each format', () => {
    const failures: OfficeImportFailure[] = [
      'too-large',
      'legacy',
      'not-a-package',
      'wrong-format',
      'unpacks-too-large',
      'too-many-slides',
      'too-many-blocks',
      'too-large-for-tab',
    ];
    for (const f of failures) {
      expect(officeErrorMessage(f, 'word', 7)).toMatch(/\.$/);
      expect(officeErrorMessage(f, 'powerpoint')).toMatch(/\.$/);
    }
    expect(officeErrorMessage('too-many-slides', 'powerpoint', 140)).toBe(
      'This deck has 140 slides; a tab holds at most 100.',
    );
    expect(officeErrorMessage('too-many-blocks', 'word', 6200)).toBe(
      'This document makes 6,200 blocks; an article holds at most 5,000.',
    );
    expect(officeErrorMessage('legacy', 'powerpoint')).toContain('.ppt');
    expect(officeErrorMessage('wrong-format', 'powerpoint')).toBe(
      'This is a Word file. Go back and choose Word to import it.',
    );
  });
});
