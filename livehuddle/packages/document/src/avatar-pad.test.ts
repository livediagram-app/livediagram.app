import { describe, expect, it } from 'vitest';
import {
  AVATAR_PAD_DEFAULT_SIZE,
  AVATAR_PAD_TONES,
  avatarPadCore,
  avatarPadFootprint,
} from '@livehuddle/avatar/pad-art';
import {
  AVATAR_PAD_ART,
  AVATAR_PAD_CORE_POINT,
  AVATAR_PAD_VIEW,
  avatarPadPaint,
  isAvatarPadLight,
} from './avatar-pad-art';
import { AVATAR_PALETTE } from '@livehuddle/avatar/palette';
import { tint } from './colors';
import { createShape } from './shape-factory';
import { isFloorShape } from './office';
import { isBehaviourShape, carriesSharedSettingsMenu } from './behaviour-shapes';
import { isSelfDrawingShape } from './data-shapes';
import { SHAPE_KINDS } from './validate';
import { svgBehaviourFace } from './svg-render-faces';

// docs/specs/009-elements/avatar-pad.md
describe('the Avatar Pad drawing', () => {
  it('centres the drawn core, ring and well on avatarPadCore, at any box', () => {
    const view = { x: 0, y: 0, ...AVATAR_PAD_VIEW };
    expect(AVATAR_PAD_CORE_POINT).toEqual(avatarPadCore(view));
    for (const role of ['core', 'coreHot', 'ring', 'well', 'top'] as const) {
      const part = AVATAR_PAD_ART.find((p) => p.role === role);
      expect(part).toMatchObject({
        tag: 'ellipse',
        cx: AVATAR_PAD_CORE_POINT.x,
        cy: AVATAR_PAD_CORE_POINT.y,
      });
    }
    // A pad drawn in any box (fitted whole, `meet`) puts its core where the walk does.
    for (const box of [
      { x: 10, y: 20, width: 128, height: 80 },
      { x: -40, y: 5, width: 300, height: 120 },
      { x: 0, y: 0, width: 64, height: 200 },
    ]) {
      const s = Math.min(box.width / AVATAR_PAD_VIEW.width, box.height / AVATAR_PAD_VIEW.height);
      const drawn = {
        x: box.x + (box.width - AVATAR_PAD_VIEW.width * s) / 2 + AVATAR_PAD_CORE_POINT.x * s,
        y: box.y + (box.height - AVATAR_PAD_VIEW.height * s) / 2 + AVATAR_PAD_CORE_POINT.y * s,
      };
      const core = avatarPadCore(box);
      expect(drawn.x).toBeCloseTo(core.x, 6);
      expect(drawn.y).toBeCloseTo(core.y, 6);
    }
  });

  it('keeps its top face inside the footprint the walk tests standing with', () => {
    const top = AVATAR_PAD_ART.find((p) => p.role === 'top');
    const foot = avatarPadFootprint({ x: 0, y: 0, ...AVATAR_PAD_VIEW });
    expect(top?.tag).toBe('ellipse');
    if (top?.tag !== 'ellipse') return;
    expect(top.rx).toBeLessThanOrEqual(foot.rx);
    expect(top.ry).toBeLessThanOrEqual(foot.ry);
    expect(top.rx).toBeGreaterThan(foot.rx * 0.9);
  });

  it('is a fixed, small number of vector nodes, lights flagged for the shimmer', () => {
    expect(AVATAR_PAD_ART).toHaveLength(17);
    expect(AVATAR_PAD_ART.filter((p) => isAvatarPadLight(p.role))).toHaveLength(8);
    expect(AVATAR_PAD_ART.filter((p) => p.role === 'lamp')).toHaveLength(5);
  });

  it('outlines in the theme stroke and lights in the fixed cyan', () => {
    const paint = (role: Parameters<typeof avatarPadPaint>[0]) =>
      avatarPadPaint(role, '#123456', '#abcdef', 'url(#g)');
    expect(paint('top')).toMatchObject({ fill: '#abcdef', stroke: '#123456' });
    expect(paint('side')).toMatchObject({ fill: '#abcdef', stroke: '#123456' });
    expect(paint('ring').stroke).toBe(AVATAR_PAD_TONES.ring);
    expect(paint('core').fill).toBe(AVATAR_PAD_TONES.core);
    expect(paint('lamp').fill).toBe(AVATAR_PAD_TONES.lamp);
    expect(paint('glow').fill).toBe('url(#g)');
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
  it('exports the same vector drawing, fitted into the box, in the theme stroke', () => {
    const el = createShape('avatar-pad', 10, 20);
    const svg = svgBehaviourFace(el, '', '#000', '#475569') ?? '';
    expect(svg).not.toContain('crispEdges');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain(`viewBox="0 0 ${AVATAR_PAD_VIEW.width} ${AVATAR_PAD_VIEW.height}"`);
    expect((svg.match(/<(ellipse|path) /g) ?? []).length).toBe(AVATAR_PAD_ART.length);
    expect(svg).toContain('stroke="#475569"');
    expect(svg).toContain(`stroke="${AVATAR_PAD_TONES.ring}"`);
    expect(svg).toContain(`url(#avatar-pad-glow-${el.id})`);
  });
});
