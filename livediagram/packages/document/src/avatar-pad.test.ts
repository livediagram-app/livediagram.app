import { describe, expect, it } from 'vitest';
import {
  AVATAR_PAD_DEFAULT_SIZE,
  AVATAR_PAD_GRID,
  AVATAR_PAD_PARTS,
  AVATAR_PAD_TONES,
} from '@liveworkspace/avatar/pad-art';
import { AVATAR_PALETTE } from '@liveworkspace/avatar/palette';
import { tint } from './colors';
import { createShape } from './shape-factory';
import { isFloorShape } from './office';
import { isBehaviourShape, carriesSharedSettingsMenu } from './behaviour-shapes';
import { isSelfDrawingShape } from './data-shapes';
import { SHAPE_KINDS } from './validate';
import { svgBehaviourFace } from './svg-render-faces';

// docs/specs/009-elements/avatar-pad.md
describe('the Avatar Pad drawing', () => {
  it('stays on its grid, one row high per run, never overlapping in a row', () => {
    const rows = new Map<number, [number, number][]>();
    for (const p of AVATAR_PAD_PARTS) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(AVATAR_PAD_GRID.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(AVATAR_PAD_GRID.height);
      rows.set(p.y, [...(rows.get(p.y) ?? []), [p.x, p.x + p.width]]);
    }
    for (const spans of rows.values()) {
      const sorted = [...spans].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < sorted.length; i++)
        expect(sorted[i]![0]).toBeGreaterThanOrEqual(sorted[i - 1]![1]);
    }
  });

  it('is a handful of rects, merged per row (a cheap paint on the canvas and in an export)', () => {
    expect(AVATAR_PAD_PARTS.length).toBeLessThan(200);
  });

  it('has a ring that shimmers, a core and side lamps, in the sprite palette', () => {
    const roles = new Set(AVATAR_PAD_PARTS.map((p) => p.role));
    expect([...roles].sort()).toEqual(['body', 'core', 'lamp', 'ring']);
    const fills = new Set(AVATAR_PAD_PARTS.map((p) => p.fill));
    expect(fills.has(AVATAR_PALETTE.shoe)).toBe(true);
    expect(fills.has(AVATAR_PALETTE.trousers)).toBe(true);
    expect(fills.has(AVATAR_PALETTE.coat)).toBe(true);
    expect(fills.has(AVATAR_PALETTE.shirt)).toBe(true);
  });

  it("writes out the shirt cyan's mixes exactly as tint makes them", () => {
    expect(AVATAR_PAD_TONES.ringLit).toBe(tint(AVATAR_PALETTE.shirt, 0.45));
    expect(AVATAR_PAD_TONES.core).toBe(tint(AVATAR_PALETTE.shirt, 0.72));
    expect(AVATAR_PAD_TONES.lamp).toBe(tint(AVATAR_PALETTE.shirt, 0.3));
  });
});

describe('the avatar-pad kind', () => {
  it('is a known, wordless, floor-lying Behaviour element with no settings', () => {
    expect(SHAPE_KINDS.has('avatar-pad')).toBe(true);
    expect(isFloorShape('avatar-pad')).toBe(true);
    expect(isBehaviourShape('avatar-pad')).toBe(true);
    expect(carriesSharedSettingsMenu('avatar-pad')).toBe(false);
    expect(isSelfDrawingShape('avatar-pad')).toBe(true);
  });
  it('is made label-less, at its grid size, with its proportions locked', () => {
    const el = createShape('avatar-pad', 10, 20);
    expect(el).toMatchObject({ label: '', aspectLocked: true, ...AVATAR_PAD_DEFAULT_SIZE });
  });
  it('exports the same pixels, crisp, scaled into the box', () => {
    const el = createShape('avatar-pad', 10, 20);
    const svg = svgBehaviourFace(el, '', '#000', '#000') ?? '';
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg.match(/<rect /g)).toHaveLength(AVATAR_PAD_PARTS.length);
    expect(svg).toContain(`fill="${AVATAR_PALETTE.shirt}"`);
  });
});
