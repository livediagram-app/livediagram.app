import { describe, expect, it } from 'vitest';
import { laidOutPagesOf, type Element, type Page, type Tab } from '@livedesign/document';
import { blankQuestion, type FormDefinition } from '@livedesign/forms';
import { renderTabToSvg } from './export-tab';
import { pageElements, renderTabDrawingSvg, tabDrawingFontIdsOf } from './tab-drawing';
import { svgFrameOf } from './svg-frame';

// docs/specs/009-elements/tab-window.md "The drawing": every mode is drawn, a Pages tab as its pages and a Form tab as
// its form.

const box = (id: string, label: string, at: { x: number; y: number }): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  ...at,
  width: 120,
  height: 60,
  label,
});
const tab = (extra: Partial<Tab>): Tab => ({ id: 't', name: 'T', elements: [], ...extra });

const form: FormDefinition = {
  v: 1,
  heading: 'Team Survey',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [{ ...blankQuestion('short', 'q-1'), prompt: 'Your Role' }],
    },
  ],
};

describe('renderTabDrawingSvg', () => {
  it('draws a Diagram or Draw tab as its canvas', () => {
    const t = tab({ elements: [box('a', 'Checkout', { x: 0, y: 0 })] });
    expect(renderTabDrawingSvg(t)).toBe(renderTabToSvg(t));
    const draw = { ...t, opensIn: 'draw' as const };
    expect(renderTabDrawingSvg(draw)).toBe(renderTabToSvg(draw));
  });

  it('draws a Form tab as its form on its look, though no element is on it', () => {
    const svg = renderTabDrawingSvg(tab({ kind: 'form', form, theme: 'ocean' }));
    expect(svg).toContain('Team Survey');
    expect(svg).toContain('Your Role');
    expect(svg).toContain('Submit');
  });

  it('draws a Form tab whose form cannot be read as its canvas', () => {
    const t = tab({ kind: 'form', form: [] as never });
    expect(renderTabDrawingSvg(t)).toBe(renderTabToSvg(t));
  });

  it('draws a Pages tab as each page where it lies, its own ids per page', () => {
    const pages: Page[] = [
      { id: 'p1', orientation: 'landscape', kind: 'logo' },
      { id: 'p2', orientation: 'landscape', kind: 'logo' },
    ];
    const [one, two] = laidOutPagesOf(tab({ opensIn: 'pages', pages }));
    const t = tab({
      opensIn: 'pages',
      pages,
      elements: [
        box('a', 'Opening', { x: one!.rect.x + 40, y: one!.rect.y + 40 }),
        box('b', 'Closing', { x: two!.rect.x + 40, y: two!.rect.y + 40 }),
        // On the desk, off every page: not part of what the pages show.
        box('c', 'Stray', { x: two!.rect.x + two!.rect.width + 400, y: 0 }),
      ],
    });
    const svg = renderTabDrawingSvg(t);
    expect(svg).toContain('Opening');
    expect(svg).toContain('Closing');
    expect(svg).not.toContain('Stray');
    // The drawing spans the row of pages in canvas space, so the desk's pattern lines up with it.
    const frame = svgFrameOf(svg);
    expect(frame.origin).toEqual({ x: one!.rect.x, y: one!.rect.y });
    expect(frame.width).toBeCloseTo(two!.rect.x + two!.rect.width - one!.rect.x, 1);
    // Each page nested at its rect.
    expect(svg).toContain(`<svg x="${one!.rect.x}" y="${one!.rect.y}" `);
    expect(svg).toContain(`<svg x="${two!.rect.x}" y="${two!.rect.y}" `);
    // No id shared between the pages.
    const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('draws a blank Pages tab as its blank page', () => {
    const svg = renderTabDrawingSvg(tab({ opensIn: 'pages' }));
    expect(svg).toContain('<svg x="');
  });
});

describe('tabDrawingFontIdsOf', () => {
  it("names a form's typeface and its elements'", () => {
    expect(tabDrawingFontIdsOf(tab({ kind: 'form', form, font: 'marker' }))).toContain('marker');
  });
});

describe('pageElements', () => {
  it('gives each page the elements reaching it, an arrow there with what it is pinned to', () => {
    const pages: Page[] = [
      { id: 'p1', orientation: 'landscape', kind: 'logo' },
      { id: 'p2', orientation: 'landscape', kind: 'logo' },
    ];
    const [one, two] = laidOutPagesOf(tab({ opensIn: 'pages', pages }));
    const a = box('a', 'A', { x: one!.rect.x + 10, y: one!.rect.y + 10 });
    const b = box('b', 'B', { x: two!.rect.x + 10, y: two!.rect.y + 10 });
    const c = box('c', 'C', { x: two!.rect.x + 400, y: two!.rect.y + 10 });
    // Spans both pages, so each draws it, and each needs both ends to resolve it.
    const ab: Element = {
      id: 'ab',
      type: 'arrow',
      from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
    };
    // Sits on that arrow: it follows the arrow's own ends.
    const onAb: Element = {
      id: 'on',
      type: 'arrow',
      from: { kind: 'on-arrow', arrowId: 'ab', t: 0.5 },
      to: { kind: 'free', x: one!.rect.x + 50, y: one!.rect.y + 300 },
    };
    const [p1, p2] = pageElements([a, b, c, ab, onAb], [one!, two!]);
    expect(p1!.map((e) => e.id)).toEqual(['a', 'b', 'ab', 'on']);
    expect(p2!.map((e) => e.id)).toEqual(['a', 'b', 'c', 'ab']);
  });
});
