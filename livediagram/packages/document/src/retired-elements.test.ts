import { describe, expect, it } from 'vitest';
import {
  isChairFacing,
  isRetiredElement,
  isRetiredFloorKind,
  isRetiredShapeKind,
  isRoomDoor,
  isUprightRetiredKind,
  RETIRED_ELEMENT_LINE,
  RETIRED_SHAPE_KINDS,
  retiredCreateRefusal,
  retiredElementName,
  retiredKindRefusal,
} from './retired-elements';
import { retiredPlaceholderPlan } from './retired-placeholder';
import { isButtonMode, NEW_BUTTON_MODE, withNewButtonModes } from './selection-mode';
import { CREATABLE_SHAPE_KINDS, SHAPE_KINDS } from './validate';
import { graphShapeError } from './graph-input';

// Retired elements (docs/specs/009-elements/retired-elements.md): the Spaces and Avatar pieces that moved to
// livehuddle, kept as stored, drawn as a placeholder, never made new.
describe('retired elements', () => {
  const shape = (kind: string, extra: Record<string, unknown> = {}) => ({
    type: 'shape',
    shape: kind,
    ...extra,
  });

  it('knows every retired kind, and nothing else', () => {
    for (const k of RETIRED_SHAPE_KINDS) expect(isRetiredShapeKind(k)).toBe(true);
    expect(isRetiredShapeKind('square')).toBe(false);
    expect(isRetiredShapeKind(7)).toBe(false);
  });

  it('retires an Avatar button, stored with that mode or with none, but no other button', () => {
    expect(isRetiredElement(shape('mode-button', { mode: 'avatar' }))).toBe(true);
    expect(isRetiredElement(shape('mode-button'))).toBe(true);
    expect(isRetiredElement(shape('mode-button', { mode: 'laser' }))).toBe(false);
    expect(isRetiredElement(shape('chair'))).toBe(true);
    expect(isRetiredElement(shape('square'))).toBe(false);
    expect(isRetiredElement({ type: 'text' })).toBe(false);
    expect(isRetiredElement(null)).toBe(false);
  });

  it('names a retired piece, and nothing for a live one', () => {
    expect(retiredElementName(shape('water-cooler'))).toBe('Water Cooler');
    expect(retiredElementName(shape('mode-button'))).toBe('Avatar Button');
    expect(retiredElementName(shape('square'))).toBeNull();
  });

  it('keeps the stored turn and floor reading per kind', () => {
    expect(isUprightRetiredKind('sofa')).toBe(true);
    expect(isUprightRetiredKind('fence')).toBe(false);
    expect(isRetiredFloorKind('rug')).toBe(true);
    expect(isRetiredFloorKind('chair')).toBe(false);
    expect(isChairFacing('e')).toBe(true);
    expect(isChairFacing('x')).toBe(false);
    expect(isRoomDoor('none')).toBe(true);
    expect(isRoomDoor('up')).toBe(false);
  });

  it('refuses a new retired piece or Avatar button, and lets everything else through', () => {
    expect(retiredCreateRefusal(shape('desk'))).toBe(retiredKindRefusal('desk'));
    expect(retiredKindRefusal('desk')).toContain('livehuddle');
    expect(retiredCreateRefusal(shape('mode-button', { mode: 'avatar' }))).toContain('livehuddle');
    // A button with no mode is given NEW_BUTTON_MODE by whoever makes it, not refused.
    expect(retiredCreateRefusal(shape('mode-button'))).toBeNull();
    expect(retiredCreateRefusal(shape('square'))).toBeNull();
    expect(retiredCreateRefusal({ type: 'text' })).toBeNull();
    expect(retiredCreateRefusal(undefined)).toBeNull();
  });

  it('leaves retired kinds out of what may be created, though validation still reads them', () => {
    for (const k of RETIRED_SHAPE_KINDS) {
      expect(SHAPE_KINDS.has(k)).toBe(true);
      expect(CREATABLE_SHAPE_KINDS.has(k)).toBe(false);
    }
    expect(CREATABLE_SHAPE_KINDS.has('square')).toBe(true);
  });

  it('refuses a graph node drawn as a retired kind', () => {
    const error = graphShapeError({
      nodes: [{ id: 'a', label: 'Lobby', shape: 'rug' }],
      edges: [],
    });
    expect(error).toBe(`node "a": ${retiredKindRefusal('rug')}`);
  });
});

describe('Selection Mode buttons after Avatar', () => {
  it('hands out every mode but Avatar', () => {
    expect(isButtonMode('spotlight')).toBe(true);
    expect(isButtonMode('avatar')).toBe(false);
    expect(isButtonMode(undefined)).toBe(false);
  });

  it('gives a new button with no mode the new default, leaving kept and set ones alone', () => {
    const els = [
      { type: 'shape', id: 'new', shape: 'mode-button' },
      { type: 'shape', id: 'old', shape: 'mode-button' },
      { type: 'shape', id: 'set', shape: 'mode-button', mode: 'laser' },
      { type: 'shape', id: 'box', shape: 'square' },
    ];
    const out = withNewButtonModes(els, new Set(['old']));
    expect(out.map((e) => (e as { mode?: string }).mode)).toEqual([
      NEW_BUTTON_MODE,
      undefined,
      'laser',
      undefined,
    ]);
    expect(withNewButtonModes(els)[1]).toMatchObject({ mode: NEW_BUTTON_MODE });
  });
});

describe('the retired placeholder plan', () => {
  it('names the piece, or its own label with the piece under it', () => {
    const big = { width: 160, height: 120 };
    expect(retiredPlaceholderPlan(big, 'Sofa', '')).toMatchObject({
      title: 'Sofa',
      caption: RETIRED_ELEMENT_LINE,
      glyph: true,
    });
    expect(retiredPlaceholderPlan(big, 'Room', '  Kitchen  ').caption).toBe(
      `Room · ${RETIRED_ELEMENT_LINE}`,
    );
  });

  it('sheds the glyph, then the caption, as the box shrinks', () => {
    expect(retiredPlaceholderPlan({ width: 80, height: 60 }, 'Plant', undefined)).toMatchObject({
      glyph: false,
      caption: RETIRED_ELEMENT_LINE,
    });
    expect(retiredPlaceholderPlan({ width: 40, height: 30 }, 'Plant', undefined)).toMatchObject({
      glyph: false,
      caption: null,
      radius: 7.5,
    });
  });

  it('wraps a long name over two lines and the caption over two rows rather than clipping them', () => {
    // An Avatar button's 104 x 96 box: neither line fits whole on one row.
    const plan = retiredPlaceholderPlan({ width: 104, height: 96 }, 'Avatar Button', '');
    expect(plan.titleLines).toEqual(['Avatar', 'Button']);
    expect(plan.captionLines).toEqual(['Moved to', 'livehuddle']);
    expect(plan.glyph).toBe(false);
    for (const line of [...plan.titleLines, ...plan.captionLines])
      expect(line).not.toContain('\u2026');
  });

  it('drops the caption it cannot fit whole, and keeps the name, clipped only when nothing else is left', () => {
    const chair = retiredPlaceholderPlan({ width: 76, height: 84 }, 'Chair', undefined);
    expect(chair).toMatchObject({ titleLines: ['Chair'], caption: null, captionLines: [] });
    const tiny = retiredPlaceholderPlan({ width: 40, height: 60 }, 'Water Cooler', undefined);
    expect(tiny.titleLines.length).toBeLessThanOrEqual(2);
    expect(tiny.titleLines.at(-1)).toMatch(/\u2026$/);
  });

  it('falls back to the plain line when the labelled caption does not fit', () => {
    const plan = retiredPlaceholderPlan({ width: 140, height: 44 }, 'Room', 'Kitchen');
    expect(plan.titleLines).toEqual(['Kitchen']);
    expect(plan.captionLines).toEqual([RETIRED_ELEMENT_LINE]);
  });

  it('puts a Room at its top, with no glyph, so the pieces inside never cover it', () => {
    const plan = retiredPlaceholderPlan(
      { width: 480, height: 320, shape: 'room' },
      'Room',
      'Studio',
    );
    expect(plan).toMatchObject({ anchor: 'top', glyph: false, titleLines: ['Studio'] });
    expect(retiredPlaceholderPlan({ width: 480, height: 320 }, 'Sofa', '').anchor).toBe('center');
  });
});
