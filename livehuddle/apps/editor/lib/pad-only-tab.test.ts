import { describe, expect, it } from 'vitest';
import { createShape, createText } from '@livehuddle/document';
import { BLANK_PAD_DROP, buildTemplate } from '@livehuddle/templates';
import { holdsOnlyPads, padOnlyTabCentre } from './pad-only-tab';

// docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one": a tab with nothing but its pad is blank.
describe('holdsOnlyPads', () => {
  const pad = createShape('avatar-pad', 0, 0);

  it('is false for an empty tab, which is blank by having nothing', () => {
    expect(holdsOnlyPads([])).toBe(false);
  });

  it('is true for a tab holding only pads, as Blank Space makes', () => {
    expect(holdsOnlyPads([pad])).toBe(true);
    expect(holdsOnlyPads([pad, createShape('avatar-pad', 400, 0)])).toBe(true);
    expect(holdsOnlyPads(buildTemplate('blank-session', 0, 0))).toBe(true);
  });

  it('is false once anything else is on the tab', () => {
    expect(holdsOnlyPads([pad, createText(0, 0)])).toBe(false);
    expect(holdsOnlyPads([createShape('square', 0, 0)])).toBe(false);
    expect(holdsOnlyPads(buildTemplate('team-pod', 0, 0))).toBe(false);
  });
});

// The entry onto a pad-only tab opens with its pad BLANK_PAD_DROP below the middle, wherever the tab was built: the
// /new route builds the blank at (0, 0), which the default view would show in the corner.
describe('padOnlyTabCentre', () => {
  it("centres the view on the blank's build centre, the pad below it", () => {
    expect(padOnlyTabCentre(buildTemplate('blank-session', 0, 0))).toEqual({ x: 0, y: 0 });
    expect(padOnlyTabCentre(buildTemplate('blank-session', 300, -120))).toEqual({
      x: 300,
      y: -120,
    });
    const pad = buildTemplate('blank-session', 0, 0)[0]!;
    expect(pad.type === 'shape' && pad.y + pad.height / 2).toBe(BLANK_PAD_DROP);
  });

  it('is null for an empty tab and for one with anything besides pads, which the entry fits', () => {
    expect(padOnlyTabCentre([])).toBeNull();
    expect(padOnlyTabCentre(buildTemplate('team-pod', 0, 0))).toBeNull();
  });
});
