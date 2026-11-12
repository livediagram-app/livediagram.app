import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { lookPreviewSvg, lookPreviewTab } from './look-preview';
import { setAppearanceOverride } from '@livehuddle/ui';
import { resolveTheme } from './themes';
import { TAB_LOOKS, activeLookId, tabLookById } from './tab-looks';

const fills = (id: string) =>
  new Map(
    (lookPreviewTab(tabLookById(id)!).elements as Array<Element & { fillColor?: string }>).map(
      (el) => [el.id.replace('look-preview-', ''), el.fillColor],
    ),
  );

// A look's card preview (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): a tiny Space.
describe('lookPreviewSvg', () => {
  it('draws a tiny Space in each look, on a tab that reads as that look', () => {
    for (const look of TAB_LOOKS) {
      expect(activeLookId(lookPreviewTab(look)), look.id).toBe(look.id);
      const svg = lookPreviewSvg(look);
      expect(svg, look.id).toContain('Stand-up at');
      expect(svg, look.id).toContain('Huddle');
    }
  });

  it('is a room with a door, a desk and a plant, and a sticky note beside it', () => {
    const tab = lookPreviewTab(TAB_LOOKS[0]!);
    const kinds = tab.elements.map((el) => (el.type === 'shape' ? el.shape : el.type));
    expect(kinds).toEqual(['room', 'door', 'desk', 'plant', 'sticky']);
    // Every id is fixed, so the Sketch wobble is the same each time the dialog opens.
    expect(lookPreviewSvg(TAB_LOOKS[0]!)).toBe(lookPreviewSvg(TAB_LOOKS[0]!));
  });

  it("lays the scene on the look's floor, its pattern id scoped to the look", () => {
    const garden = lookPreviewSvg(tabLookById('garden')!);
    expect(garden).toContain('lvd-look-garden-bg');
    expect(garden).not.toContain('lvd-export-bg');
    // A look on None draws no floor at all.
    expect(lookPreviewSvg(tabLookById('whiteboard')!)).not.toContain('<pattern');
  });

  it('bleeds the canvas colour and floor past the view, so a wider card shows floor at its sides', () => {
    const svg = lookPreviewSvg(tabLookById('garden')!);
    const [vx, vy, vw, vh] = /viewBox="([^"]+)"/.exec(svg)![1]!.split(' ').map(Number) as [
      number,
      number,
      number,
      number,
    ];
    const backdrop = /<rect x="([-\d]+)" y="([-\d]+)" width="(\d+)" height="(\d+)"/.exec(svg)!;
    const [bx, by, bw, bh] = backdrop.slice(1).map(Number) as [number, number, number, number];
    expect(bx).toBeLessThan(vx - vw / 2);
    expect(by).toBeLessThan(vy - vh / 2);
    expect(bx + bw).toBeGreaterThan(vx + vw * 1.5);
    expect(by + bh).toBeGreaterThan(vy + vh * 1.5);
    expect(svg.match(/fill="url\(#lvd-look-garden-bg\)"/g)).toHaveLength(1);
  });

  it('colours each piece as its own branch on a multi-colour look: the room first, the desk third', () => {
    for (const [id, theme] of [
      ['spectrum', 'rainbow'],
      ['lagoon', 'tropical'],
    ] as const) {
      const palette = resolveTheme(theme)!.palette!.map((p) => p.fill);
      const f = fills(id);
      expect(f.get('room'), id).toBe(palette[0]);
      expect(f.get('desk'), id).toBe(palette[2]);
    }
  });

  // UML is retired here (docs/specs/011-theme/retired-schemes.md "UML"): Textbook and Schematic wear Mono.
  it('still draws Textbook and Schematic, now in Mono', () => {
    const ink = resolveTheme('mono')!.elementStroke!;
    for (const id of ['textbook', 'schematic']) {
      const look = tabLookById(id)!;
      expect(lookPreviewTab(look).theme, id).toBe('mono');
      expect(lookPreviewSvg(look).toLowerCase(), id).toContain(ink.toLowerCase());
    }
  });

  it('draws the Sketch looks sketched, and the Marker looks in marker', () => {
    expect(lookPreviewSvg(tabLookById('notebook')!)).toContain('data-finish="sketch"');
    expect(lookPreviewSvg(tabLookById('whiteboard')!)).toContain('data-finish="marker"');
  });

  it("builds a card once per half, and again in the viewer's other half", () => {
    const look = tabLookById('midnight')!;
    const light = lookPreviewSvg(look);
    expect(lookPreviewSvg(look)).toBe(light);
    expect(lookPreviewTab(look)).toBe(lookPreviewTab(look));
    setAppearanceOverride('dark');
    try {
      expect(lookPreviewSvg(look)).not.toBe(light);
    } finally {
      setAppearanceOverride(null);
    }
    expect(lookPreviewSvg(look)).toBe(light);
  });

  it('keeps every card small: the dialog builds them all when it opens', () => {
    const sizes = TAB_LOOKS.map((look) => lookPreviewSvg(look).length);
    expect(Math.max(...sizes)).toBeLessThan(48_000);
    expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThan(560_000);
  });
});
