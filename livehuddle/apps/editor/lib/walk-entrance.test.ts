import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { buildTemplate, TEMPLATES, templateCategory } from '@livehuddle/templates';
import { AVATAR_SIZES, avatarScale } from '@liveworkspace/avatar/config';
import { avatarFigureHeight, avatarSpawnBelow } from '@liveworkspace/avatar/walk';
import { walkEntrance } from './walk-entrance';

// docs/specs/008-canvas/avatar-mode.md "Opening walking": which tab offers the walk, and where it starts you.
const button = (id: string, x: number, y: number, mode?: 'avatar'): Element => ({
  ...createShape('mode-button', x, y),
  id,
  ...(mode ? { mode } : {}),
});
const pad = (id: string): Element => ({ ...createShape('avatar-pad', 0, 0), id });
const square = (id: string): Element => ({ ...createShape('square', 0, 0), id });

describe('walkEntrance', () => {
  it('offers no walk on an empty tab or one with neither a pad nor an Avatar button', () => {
    expect(walkEntrance([])).toBeNull();
    expect(walkEntrance([square('a')])).toBeNull();
  });

  it('starts you below the first Avatar button, handing on its box', () => {
    const first = button('b1', 100, 200, 'avatar');
    const entrance = walkEntrance([square('a'), first, button('b2', 900, 900)]);
    const { width, height } = createShape('mode-button', 0, 0);
    expect(entrance).toEqual({ kind: 'button', button: { x: 100, y: 200, width, height } });
  });

  it('reads a button with no mode as Avatar, the default a new button hands out', () => {
    expect(walkEntrance([button('b', 0, 0)])?.kind).toBe('button');
  });

  it('lets a pad win over a button wherever it sits in the paint order', () => {
    expect(walkEntrance([button('b', 0, 0, 'avatar'), pad('p')])).toEqual({
      kind: 'pad',
    });
  });

  // Every Spaces template offers the walk, and no other template does: a Space made from one opens walking.
  it('opens every Spaces template walking, and no other', () => {
    const offering = TEMPLATES.map((t) => t.kind).filter(
      (kind) => walkEntrance(buildTemplate(kind, 0, 0)) !== null,
    );
    const spaces = TEMPLATES.map((t) => t.kind).filter(
      (kind) => kind !== 'blank-session' && templateCategory(kind) !== null,
    );
    expect(spaces.length).toBe(10);
    expect(offering.sort()).toEqual(spaces.sort());
  });

  // Work Tracker #346: the opening character stood over the Walk In button and hid its label.
  it('opens every Spaces template with the whole character clear of Walk In, at every size', () => {
    const spaces = TEMPLATES.map((t) => t.kind).filter(
      (kind) => kind !== 'blank-session' && templateCategory(kind) !== null,
    );
    for (const kind of spaces) {
      const entrance = walkEntrance(buildTemplate(kind, 0, 0));
      if (entrance?.kind !== 'button') throw new Error(`${kind} opens without a Walk In button`);
      const { button: walkInBox } = entrance;
      for (const size of AVATAR_SIZES) {
        const scale = avatarScale(size.id);
        const feet = avatarSpawnBelow(walkInBox, scale);
        const head = feet.y - avatarFigureHeight(scale);
        expect(head, `${kind} at ${size.id}`).toBeGreaterThan(walkInBox.y + walkInBox.height);
        expect(feet.x).toBe(walkInBox.x + walkInBox.width / 2);
      }
    }
  });
});
