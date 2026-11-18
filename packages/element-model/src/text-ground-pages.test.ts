import { describe, expect, it } from 'vitest';
import type { BoxedElement, Element } from './element';
import { pagedTextGroundFor } from './text-ground-pages';

// Each paged product's docs/specs/004-interface-design/colour-picker.md "Reading on its ground".
type Fill = { kind: string; tone?: string };
type Page = {
  rect: { x: number; y: number; width: number; height: number };
  background?: { fill?: Fill };
};

const box = (id: string, type: string, extra: object = {}): BoxedElement =>
  ({ id, type, x: 40, y: 40, width: 120, height: 30, ...extra }) as unknown as BoxedElement;

const groundOf = pagedTextGroundFor({
  layerBands: (elements: Element[], layers: { hidden?: string[] }[] | undefined) => [
    { elements: elements.filter((e) => !layers?.[0]?.hidden?.includes(e.id)) },
  ],
  pagesOf: (tab: { pages: Page[] }) => tab.pages,
  layOutPages: (pages: readonly Page[]) => [...pages],
  rowPageAt: (row: readonly Page[], p: { x: number; y: number }) =>
    row.find((r) => p.x >= r.rect.x && p.x <= r.rect.x + r.rect.width),
  pageGroundUnder: (bg: { fill?: Fill } | undefined) => ({ tones: [bg?.fill?.tone ?? '#ffffff'] }),
});

const page = (fill?: Fill): Page => ({
  rect: { x: 0, y: 0, width: 400, height: 300 },
  background: fill ? { fill } : undefined,
});

describe('pagedTextGroundFor', () => {
  it('reads text with nothing under it on its page', () => {
    const t = box('t', 'text');
    const dark = page({ kind: 'solid', tone: '#0f172a' });
    expect(groundOf(t, { elements: [t], pages: [dark] }, 'light')).toEqual({
      tones: ['#0f172a'],
      on: 'page',
    });
    expect(groundOf(t, { elements: [t], pages: [page()] }, 'light')!.tones).toEqual(['#ffffff']);
  });

  it('reads text on a filled box under it, unless that box is on a hidden layer', () => {
    const t = box('t', 'text');
    const card = box('c', 'shape', {
      shape: 'square',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      fillColor: '#fecaca',
    });
    const tab = { elements: [card, t] as Element[], pages: [page()] };
    expect(groundOf(t, tab, 'light')).toEqual({ tones: ['#fecaca'], on: 'card' });
    expect(groundOf(t, { ...tab, layers: [{ hidden: ['c'] }] }, 'light')!.on).toBe('page');
  });

  it('judges nothing off every page or on a picture page', () => {
    const off = box('t', 'text', { x: 900 });
    expect(groundOf(off, { elements: [off], pages: [page()] }, 'light')).toBeNull();
    const t = box('t', 'text');
    expect(groundOf(t, { elements: [t], pages: [page({ kind: 'image' })] }, 'light')).toBeNull();
  });
});
