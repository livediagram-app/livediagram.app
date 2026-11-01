import { describe, expect, it } from 'vitest';
import {
  PAGE_GAP,
  pagesOf,
  layOutPages,
  pageDimensions,
  pageHasOrientation,
  pageLabel,
  pageMargin,
  withPages,
  type Page,
} from './page';
import {
  elementIdsOnPage,
  elementsOnPage,
  elementPageSurfaces,
  elementPageTones,
  legibleOn,
  pageFillTone,
  pageIsDark,
  pageSurface,
  withDuplicatedPage,
  withPageContentReplaced,
} from './page-content';
import { withPageInkFor } from './page-ink';
import { contrastRatio } from './colors';
import type { Element } from './index';

// docs/specs/007-editor/pages-mode.md: a page's size, background and name, and the edits
// that carry its content.
const box = (id: string, cx: number, cy: number) =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: cx - 10,
    y: cy - 10,
    width: 20,
    height: 20,
  }) as Element;
const centre = (el: Element) =>
  el.type === 'arrow' ? null : { x: el.x + el.width / 2, y: el.y + el.height / 2 };

describe('a page', () => {
  it('keeps its valid optional fields and drops the rest', () => {
    const [page] = pagesOf({
      pages: [
        {
          id: 'p',
          orientation: 'portrait',
          // A size no page takes any more.
          size: 'square',
          background: { fill: { kind: 'solid', color: 'red' }, pattern: 'dots' },
          name: '  Launch  ',
        },
      ],
    });
    expect(page).toEqual({
      id: 'p',
      orientation: 'portrait',
      background: { pattern: 'dots' },
      name: 'Launch',
    });
  });

  it('normalises a gradient angle and drops an unknown size', () => {
    const [page] = pagesOf({
      pages: [
        {
          id: 'p',
          orientation: 'landscape',
          size: 'tabloid',
          background: { fill: { kind: 'gradient', from: '#fff', to: '#000000', angle: -20 } },
        },
      ],
    });
    expect(page).toEqual({
      id: 'p',
      orientation: 'landscape',
      background: { fill: { kind: 'gradient', from: '#fff', to: '#000000', angle: 340 } },
    });
  });

  it('measures every size, the long side upright in portrait', () => {
    expect(pageDimensions({ orientation: 'portrait' })).toEqual({ width: 794, height: 1123 });
    expect(pageDimensions({ orientation: 'landscape' })).toEqual({ width: 1123, height: 794 });
    expect(pageDimensions({ orientation: 'landscape', size: 'logo' })).toEqual({
      width: 1024,
      height: 1024,
    });
    expect(pageHasOrientation({ size: 'logo' })).toBe(false);
    expect(pageMargin({ orientation: 'portrait' })).toBe(56);
  });

  it('names itself by its name, or its place once there are several', () => {
    expect(pageLabel({ orientation: 'portrait' }, 0, 1)).toBe('A4 · Portrait');
    expect(pageLabel({ orientation: 'landscape' }, 1, 2)).toBe('Page 2 · A4 · Landscape');
    expect(
      pageLabel({ orientation: 'portrait', size: 'logo', kind: 'logo', name: 'Launch' }, 0, 3),
    ).toBe('Launch · 1024 x 1024 · Logo');
    expect(pageLabel({ orientation: 'portrait', kind: 'logo' }, 1, 2)).toBe(
      'Page 2 · A4 · Portrait · Logo',
    );
  });

  it('lays mixed sizes out in a row, each centred on the axis', () => {
    const [a, b] = layOutPages([
      { id: 'a', orientation: 'portrait' },
      { id: 'b', orientation: 'portrait', size: 'logo', kind: 'logo' },
    ]);
    expect(b!.rect.x).toBe(a!.rect.x + a!.rect.width + PAGE_GAP);
    expect(b!.rect.y).toBe(-512);
  });

  it('re-centres its content when its size changes, and moves the pages after it', () => {
    const pages: Page[] = [
      { id: 'a', orientation: 'portrait' },
      { id: 'b', orientation: 'portrait' },
    ];
    const [, b] = layOutPages(pages);
    const onB = box('x', b!.rect.x + b!.rect.width / 2, 0);
    const next = withPages({ elements: [onB], pages }, [
      { id: 'a', orientation: 'landscape' },
      { id: 'b', orientation: 'portrait' },
    ]);
    const [, b2] = layOutPages(next.pages);
    expect(centre(next.elements[0]!)).toEqual({ x: b2!.rect.x + b2!.rect.width / 2, y: 0 });
  });
});

describe('page content', () => {
  const pages: Page[] = [
    { id: 'a', orientation: 'portrait', name: 'Intro' },
    { id: 'b', orientation: 'portrait' },
  ];
  const [, laidB] = layOutPages(pages);
  const bx = laidB!.rect.x + laidB!.rect.width / 2;
  const onA = [box('a1', 0, 0), box('a2', 100, 100)];
  const arrow = {
    id: 'ar',
    type: 'arrow',
    from: { kind: 'pinned', elementId: 'a1', anchor: 'e' },
    to: { kind: 'pinned', elementId: 'a2', anchor: 'w' },
  } as Element;
  const tab = { elements: [...onA, arrow, box('b1', bx, 0)], pages };

  it('knows what is on a page, arrows by their midpoint', () => {
    const laid = layOutPages(pages);
    expect([...elementIdsOnPage(tab.elements, laid, 'a')].sort()).toEqual(['a1', 'a2', 'ar']);
    expect([...elementIdsOnPage(tab.elements, laid, 'b')]).toEqual(['b1']);
    expect(elementsOnPage(tab.elements, laid, 'a').map((el) => el.id)).toEqual(['a1', 'a2', 'ar']);
  });

  it('duplicates a page with its content, pinned arrows re-pinned to the copies', () => {
    const next = withDuplicatedPage(tab, 'a', 'page-9');
    expect(next.pages.map((p) => p.id)).toEqual(['a', 'page-9', 'b']);
    expect(next.pages[1]!.name).toBe('Intro copy');
    const laid = layOutPages(next.pages);
    const originals = new Set(tab.elements.map((el) => el.id));
    const copies = next.elements.filter((el) => !originals.has(el.id));
    expect(copies).toHaveLength(3);
    const copiedArrow = copies.find((el) => el.type === 'arrow')!;
    const copiedBoxIds = new Set(copies.filter((el) => el.type !== 'arrow').map((el) => el.id));
    expect(
      copiedArrow.type === 'arrow' &&
        copiedArrow.from.kind === 'pinned' &&
        copiedBoxIds.has(copiedArrow.from.elementId),
    ).toBe(true);
    // The copies sit on the copy; the page after moved along with its content.
    expect([...elementIdsOnPage(next.elements, laid, 'page-9')].sort()).toEqual(
      copies.map((el) => el.id).sort(),
    );
    expect([...elementIdsOnPage(next.elements, laid, 'b')]).toEqual(['b1']);
  });

  it('leaves behind a copy of an arrow riding an arrow that stays behind', () => {
    const offPin = {
      id: 'off',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a1', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b1', anchor: 'w' },
    } as Element;
    // Midpoint on page a, riding 'off', which is pinned to b1 off the page.
    const rider = {
      id: 'rides',
      type: 'arrow',
      from: { kind: 'on-arrow', arrowId: 'off', t: 0.1 },
      to: { kind: 'free', x: 50, y: 50 },
    } as Element;
    const base = { ...tab, elements: [...tab.elements, offPin, rider] };
    const next = withDuplicatedPage(base, 'a', 'p2');
    const originals = new Set(base.elements.map((el) => el.id));
    const copies = next.elements.filter((el) => !originals.has(el.id));
    expect(copies.filter((el) => el.type === 'arrow')).toHaveLength(1);
  });

  it('removes arrows riding a removed arrow, in turn, with the page’s content', () => {
    const rider = {
      id: 'rider',
      type: 'arrow',
      from: { kind: 'on-arrow', arrowId: 'ar', t: 0.5 },
      to: { kind: 'pinned', elementId: 'b1', anchor: 'w' },
    } as Element;
    const next = withPageContentReplaced({ ...tab, elements: [...tab.elements, rider] }, 'a', []);
    expect(next.elements.map((el) => el.id)).toEqual(['b1']);
  });

  it('keeps a copied name within the name limit, and reads a repeated page id once', () => {
    const long = { ...tab, pages: [{ ...pages[0]!, name: 'x'.repeat(60) }, pages[1]!] };
    expect(withDuplicatedPage(long, 'a', 'p2').pages[1]!.name!.length).toBe(60);
    expect(pagesOf({ pages: [pages[0], pages[0], pages[1]] }).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('replaces a page’s content, arrows pinned to it going too', () => {
    const next = withPageContentReplaced(tab, 'a', [box('n', 0, 0)]);
    expect(next.elements.map((el) => el.id)).toEqual(['b1', 'n']);
  });
});

describe('page backgrounds', () => {
  it('read a gradient as its stops’ mean, dark or light', () => {
    expect(pageFillTone({ kind: 'gradient', from: '#000000', to: '#ffffff', angle: 0 })).toBe(
      '#808080',
    );
    expect(pageIsDark({ background: { fill: { kind: 'solid', color: '#0f172a' } } })).toBe(true);
    expect(pageSurface({ background: { fill: { kind: 'solid', color: '#fef9c3' } } })).toBe(
      'light',
    );
    expect(pageSurface({})).toBeNull();
  });

  it('ink elements on a filled page for that page, and leave the rest to the canvas', () => {
    const pages = layOutPages([
      {
        id: 'a',
        orientation: 'portrait',
        background: { fill: { kind: 'solid', color: '#0f172a' } },
      },
      { id: 'b', orientation: 'portrait' },
    ]);
    const onA = box('x', 0, 0);
    const onB = box('y', pages[1]!.rect.x + 50, 0);
    const off = box('z', 0, 5000);
    const surfaces = elementPageSurfaces([onA, onB, off], pages);
    expect([...surfaces]).toEqual([['x', 'dark']]);
    expect(elementPageSurfaces([onA], layOutPages([pages[1]!])).size).toBe(0);
    // And the page's tone, which a label with no fill of its own is read against.
    const twin = box('w', 10, 10);
    expect([...elementPageTones([onA, twin, onB, off], pages)]).toEqual([
      ['x', '#0f172a'],
      ['w', '#0f172a'],
    ]);
  });
});

describe('page ink', () => {
  it('lightens own-coloured text on a dark page, keeps what reads, leaves cards alone', () => {
    const dark = { kind: 'solid', color: '#0f172a' } as const;
    const tab = {
      elements: [
        { id: 't', type: 'text', x: -10, y: -10, width: 20, height: 20, textColor: '#1e3a8a' },
        { id: 'ok', type: 'text', x: -10, y: -10, width: 20, height: 20, textColor: '#fde68a' },
        { ...box('card', 0, 0), textColor: '#111827', fillColor: '#ffffff' },
      ] as Element[],
      pages: [{ id: 'p', orientation: 'portrait' as const }],
    };
    const out = withPageInkFor(tab, 'p', { fill: dark });
    const t = out.elements.find((e) => e.id === 't') as Element & { textColor: string };
    expect(contrastRatio(t.textColor, '#0f172a')).toBeGreaterThanOrEqual(4.5);
    expect((out.elements[1] as { textColor: string }).textColor).toBe('#fde68a');
    expect(out.elements[2]).toBe(tab.elements[2]);
  });

  it('darkens a pale colour back on a light page', () => {
    expect(contrastRatio(legibleOn('#e0f2fe', '#ffffff'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps a colour that clears the floor, and re-inks one under a raised floor', () => {
    // #2563eb on white is about 5.2:1: kept at the default 3:1 floor and at 4.5.
    expect(legibleOn('#2563eb', '#ffffff')).toBe('#2563eb');
    // #0ea5e9 on white is about 2.8:1: kept at a 2.5 floor, pushed to AA at a 4.5 floor.
    expect(legibleOn('#0ea5e9', '#ffffff', 2.5)).toBe('#0ea5e9');
    expect(contrastRatio(legibleOn('#0ea5e9', '#ffffff', 4.5), '#ffffff')).toBeGreaterThanOrEqual(
      4.5,
    );
    // A floor above AA is also the target.
    expect(contrastRatio(legibleOn('#0ea5e9', '#ffffff', 7), '#ffffff')).toBeGreaterThanOrEqual(7);
  });
});
