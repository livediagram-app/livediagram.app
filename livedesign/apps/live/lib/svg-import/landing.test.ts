// docs/specs/020-import-export/svg-import.md "Where the shapes land": the page under the drop, else the page someone
// is on, else the page nearest the view's middle; fitted into its safe area. Plus how an SVG is told apart, the
// report's sentences and the Import dialog's routing.
import { describe, expect, it, vi } from 'vitest';
import { layOutPages, pageMargin, type Page } from '@livedesign/design';
import { isSvgFile, looksLikeSvgText } from './detect';
import { svgAwareImporters } from './dialog-runners';
import { landingBox, landingPage } from './landing';
import { emptySvgReport, svgReportLines, svgReportToast } from './report';

const pages = layOutPages([
  { id: 'a', size: 'logo' } as Page,
  { id: 'b', size: 'logo' } as Page,
  { id: 'c', size: 'logo' } as Page,
]);

describe('landingPage', () => {
  it('takes the page under the drop point first', () => {
    const b = pages[1]!.rect;
    const at = { x: b.x + 5, y: b.y + 5 };
    expect(landingPage(pages, { at, currentPageId: 'a', view: null })?.id).toBe('b');
  });
  it('then the page someone is on, then the one nearest the view, then the first', () => {
    const off = { x: -1e6, y: -1e6 };
    expect(landingPage(pages, { at: off, currentPageId: 'c', view: null })?.id).toBe('c');
    const c = pages[2]!.rect;
    expect(landingPage(pages, { currentPageId: 'gone', view: { ...c } })?.id).toBe('c');
    expect(landingPage(pages, { currentPageId: null, view: null })?.id).toBe('a');
    expect(
      landingPage([], { currentPageId: null, view: { x: 0, y: 0, width: 1, height: 1 } }),
    ).toBeUndefined();
  });
});

describe('landingBox', () => {
  it('is the page less its margin', () => {
    const p = pages[0]!;
    const m = pageMargin(p);
    expect(landingBox(p, null)).toEqual({
      x: p.rect.x + m,
      y: p.rect.y + m,
      width: p.rect.width - 2 * m,
      height: p.rect.height - 2 * m,
    });
  });
  it('falls back to a share of the view, then a square at the origin', () => {
    expect(landingBox(undefined, { x: 0, y: 0, width: 100, height: 50 })).toEqual({
      x: 20,
      y: 10,
      width: 60,
      height: 30,
    });
    expect(landingBox(undefined, null)).toEqual({ x: -200, y: -200, width: 400, height: 400 });
  });
});

describe('detect', () => {
  it('tells an SVG file by its type or name', () => {
    expect(isSvgFile({ name: 'logo.SVG', type: '' })).toBe(true);
    expect(isSvgFile({ name: 'x', type: 'image/svg+xml' })).toBe(true);
    expect(isSvgFile({ name: 'x.png', type: 'image/png' })).toBe(false);
  });
  it('tells SVG markup past whitespace, a declaration, a doctype and comments', () => {
    expect(looksLikeSvgText('  <svg viewBox="0 0 1 1"></svg>')).toBe(true);
    expect(
      looksLikeSvgText(
        '﻿<?xml version="1.0"?>\n<!-- Illustrator --><!DOCTYPE svg PUBLIC "x" "y">\n<svg>',
      ),
    ).toBe(true);
    expect(looksLikeSvgText('<!DOCTYPE svg [ <!ENTITY ns "x"> ]><svg/>')).toBe(true);
    expect(looksLikeSvgText('<svg\n xmlns="x">')).toBe(true);
    for (const t of [
      '',
      'hello',
      '<svgfoo>',
      '<div><svg>',
      '<?xml',
      '<!-- open',
      '<!DOCTYPE svg [ <!ENTITY x "y">',
      ' '.repeat(5000) + '<svg>',
    ])
      expect(looksLikeSvgText(t)).toBe(false);
  });
});

describe('report', () => {
  it('reads each kind singular and plural, only the kinds met', () => {
    const one = { text: 1, gradient: 1, mask: 1, filter: 1, clipPath: 1, image: 1, pattern: 1 };
    const two = { text: 2, gradient: 2, mask: 2, filter: 2, clipPath: 2, image: 2, pattern: 2 };
    expect(svgReportLines(one).map((l) => l.message)).toEqual([
      '1 text element was left out. Outline the text before exporting, or retype it.',
      '1 gradient fill uses its first colour.',
      '1 mask was ignored, so what it hid is shown.',
      '1 filter (shadows, blurs) was left out.',
      '1 clip path was ignored, so what it cut is shown in full.',
      '1 embedded picture was left out.',
      '1 pattern fill was left out.',
    ]);
    expect(svgReportLines(two)[1]!.message).toBe('2 gradient fills use their first colour.');
    expect(svgReportLines(two).every((l) => l.message.startsWith('2 '))).toBe(true);
    expect(svgReportLines(emptySvgReport())).toEqual([]);
  });
  it('puts the count first in the toast', () => {
    expect(svgReportToast(1, emptySvgReport())).toBe('Brought in 1 shape.');
    expect(svgReportToast(3, { ...emptySvgReport(), filter: 1 })).toBe(
      'Brought in 3 shapes. 1 filter (shadows, blurs) was left out.',
    );
  });
});

describe('svgAwareImporters', () => {
  const make = (
    locked = false,
    picked: { text: string; file?: File } | null = { text: '<svg/>' },
  ) => {
    const deps = {
      importText: vi.fn(async () => ({ status: 'done' as const })),
      importFile: vi.fn(async () => ({ status: 'done' as const })),
      importSvg: vi.fn(async () => ({ status: 'done' as const })),
      locked,
      pickFile: vi.fn(async () => picked),
    };
    return { deps, run: svgAwareImporters(deps) };
  };
  it('routes JSON to the tab import and SVG to the SVG importer', async () => {
    const { deps, run } = make();
    await run.onImportText('json', '{}');
    await run.onImportFile('json');
    expect(deps.importText).toHaveBeenCalledWith('json', '{}');
    expect(deps.importFile).toHaveBeenCalledWith('json');
    await run.onImportText('svg', '<svg/>');
    expect(deps.importSvg).toHaveBeenCalledWith('<svg/>');
    await run.onImportFile('svg');
    expect(deps.pickFile).toHaveBeenCalledWith('.svg,image/svg+xml', { maxBytes: 2 * 1024 * 1024 });
    expect(deps.importSvg).toHaveBeenLastCalledWith('<svg/>', undefined);
  });
  it('refuses a locked tab and passes a cancelled pick on', async () => {
    const locked = make(true);
    expect(await locked.run.onImportText('svg', 'x')).toMatchObject({ status: 'error' });
    expect(await locked.run.onImportFile('svg')).toMatchObject({ status: 'error' });
    const cancelled = make(false, null);
    expect(await cancelled.run.onImportFile('svg')).toEqual({ status: 'cancelled' });
  });
});
