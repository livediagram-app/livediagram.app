import { SHADOW_PRESETS, type Element, type ShapeElement } from '@livediagram/document';
import { frameOf, type Chapter, type CursorTarget, type Topic } from '../topic';
import { boxedShape } from './shared';

// Style a Shape (docs/specs/007-editor/watch-it-built.md "The curriculum"): one shape, styled through the real element
// menu: Style's Border (a thick dashed edge), Style's Shadow (a lifted shadow), then Text's Font (a handwriting face).
// The menu's rows and accordions are pressed for real (they only open); a tile press would write the shape, so each
// pick is drawn as the shape that press gives.

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'shape-border',
    name: 'Border',
    shortName: 'Border',
    ms: 8000,
    say: 'Right-click a shape, open Style, then Border for its edge.',
    sayTouch: 'Long-press a shape, open Style, then Border for its edge.',
  },
  {
    id: 'shape-shadow',
    name: 'Shadow',
    shortName: 'Shadow',
    ms: 5500,
    say: 'Shadow lifts it off the page.',
    sayTouch: 'Shadow lifts it off the page.',
  },
  {
    id: 'shape-font',
    name: 'Font',
    shortName: 'Font',
    ms: 6500,
    say: 'Text has its font, size and padding.',
    sayTouch: 'Text has its font, size and padding.',
  },
];

export const BORDER = { menu: 900, style: 1900, border: 2900, thick: 4200, dashed: 5600 } as const;
export const SHADOW = { open: 1200, pick: 2800 } as const;
export const FONT = { text: 1100, font: 2300, pick: 3800, close: 5600 } as const;

export const SHAPE_ID = 'wib-shape';
const FONT_PICK = { id: 'caveat', label: 'Caveat' } as const;
const SHADOW_PICK = SHADOW_PRESETS.find((p) => p.id === 'lifted') ?? SHADOW_PRESETS[0]!;

export type ShapeLayout = {
  readonly plain: ShapeElement;
  // Each step's shape, building on the one before.
  readonly thick: ShapeElement;
  readonly dashed: ShapeElement;
  readonly shadowed: ShapeElement;
  readonly lettered: ShapeElement;
};

// A section row in the flyout (replay-dom.ts MENU_ROWS), and a tile inside the open section.
const row = (text: string): CursorTarget => ({
  kind: 'find',
  selector: `[data-menu-flyout] button[data-menu-section="${text}"]`,
});
const tile = (text: string): CursorTarget => ({
  kind: 'find',
  selector: '[data-menu-flyout] button:not([aria-expanded])',
  text,
});

export const shape: Topic<ShapeLayout> = {
  id: 'diagram-shape',
  chapters: CHAPTERS,

  layout({ centre, size, tab }) {
    // To the left of the middle, so the menu and its flyout open to its right in view; higher on a phone, where the
    // menu is a sheet from the bottom.
    const narrow = size.width < 700;
    const x = narrow ? centre.x : centre.x - Math.min(260, size.width / 4);
    const y = narrow ? centre.y - size.height / 2 + 140 : centre.y - 200;
    const plain = boxedShape(tab, SHAPE_ID, 'Customer', 200, 80, x, y);
    const thick: ShapeElement = { ...plain, strokeWidth: 'thick' };
    const dashed: ShapeElement = { ...thick, strokeStyle: 'dashed' };
    const shadowed: ShapeElement = { ...dashed, shadow: SHADOW_PICK.shadow };
    const lettered: ShapeElement = { ...shadowed, font: FONT_PICK.id };
    return { plain, thick, dashed, shadowed, lettered };
  },

  frame(index, ms, layout) {
    const id = CHAPTERS[Math.max(0, Math.min(index, CHAPTERS.length - 1))]!.id;
    const one = (el: Element, rest: Parameters<typeof frameOf>[1]) =>
      frameOf([el], { selectedId: SHAPE_ID, ...rest });
    if (id === 'shape-border') {
      if (ms < BORDER.menu) return frameOf([layout.plain]);
      const path =
        ms >= BORDER.border ? ['Style', 'Border'] : ms >= BORDER.style ? ['Style'] : [];
      const el =
        ms >= BORDER.dashed ? layout.dashed : ms >= BORDER.thick ? layout.thick : layout.plain;
      return one(el, { menu: { on: SHAPE_ID, path } });
    }
    if (id === 'shape-shadow') {
      const path = ms >= SHADOW.open ? ['Style', 'Shadow'] : ['Style', 'Border'];
      return one(ms >= SHADOW.pick ? layout.shadowed : layout.dashed, {
        menu: { on: SHAPE_ID, path },
      });
    }
    const path = ms >= FONT.font ? ['Text', 'Font'] : ms >= FONT.text ? ['Text'] : ['Style', 'Shadow'];
    const el = ms >= FONT.pick ? layout.lettered : layout.shadowed;
    if (ms >= FONT.close) return frameOf([el]);
    return one(el, { menu: { on: SHAPE_ID, path } });
  },

  plan(index) {
    const id = CHAPTERS[index]?.id ?? 'shape-border';
    if (id === 'shape-shadow') {
      return [
        { at: SHADOW.open, to: row('Shadow'), press: true },
        { at: SHADOW.pick, to: tile(SHADOW_PICK.label), press: true },
      ];
    }
    if (id === 'shape-font') {
      return [
        { at: FONT.text, to: { kind: 'menu', name: 'Text' }, press: true },
        { at: FONT.font, to: row('Font'), press: true },
        { at: FONT.pick, to: tile(FONT_PICK.label), press: true },
        { at: FONT.close + 400, to: { kind: 'element', id: SHAPE_ID } },
      ];
    }
    return [
      { at: BORDER.menu, to: { kind: 'element', id: SHAPE_ID }, press: true },
      { at: BORDER.style, to: { kind: 'menu', name: 'Style' }, press: true },
      { at: BORDER.border, to: row('Border'), press: true },
      { at: BORDER.thick, to: tile('Thick'), press: true },
      { at: BORDER.dashed, to: tile('Dashed'), press: true },
    ];
  },
};
