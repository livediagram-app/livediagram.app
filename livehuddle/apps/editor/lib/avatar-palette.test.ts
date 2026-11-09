import { describe, expect, it } from 'vitest';
import { AVATAR_REACTIONS } from '@livehuddle/avatar/reactions';
import {
  AVATAR_PALETTE_CATEGORIES,
  behaviourStill,
  stripPaletteFor,
  titleCase,
} from './avatar-palette';
import { resolveEditorCapabilities } from './editor-capabilities';

// docs/specs/008-canvas/avatar-mode.md "The avatar palette"
const can = (level: 'edit' | 'participate' | 'view') =>
  resolveEditorCapabilities({ level, adderKey: null });

describe('stripPaletteFor', () => {
  it('gives an Editor the building palette, and the avatar palette while walking', () => {
    expect(stripPaletteFor({ can: can('edit'), readOnly: false, walking: false })).toBe('build');
    expect(stripPaletteFor({ can: can('edit'), readOnly: false, walking: true })).toBe('avatar');
  });

  it('gives an Editor on a locked tab no strip, and the avatar palette while walking', () => {
    expect(stripPaletteFor({ can: can('edit'), readOnly: true, walking: false })).toBeNull();
    expect(stripPaletteFor({ can: can('edit'), readOnly: true, walking: true })).toBe('avatar');
  });

  // docs/specs/013-workspace/share-roles.md "Always walking": a Participant and a Viewer are held in Avatar mode, so
  // the avatar palette (and the call controls at its left) is theirs even before the hold has taken the tool.
  it('always gives a Participant and a Viewer the avatar palette, even before the walk starts', () => {
    for (const level of ['participate', 'view'] as const) {
      for (const walking of [false, true]) {
        expect(stripPaletteFor({ can: can(level), readOnly: true, walking })).toBe('avatar');
      }
    }
  });
});

describe('the avatar palette categories', () => {
  it('puts the look on the left and the actions on the right', () => {
    expect(AVATAR_PALETTE_CATEGORIES.map((c) => [c.id, c.group])).toEqual([
      ['character', 0],
      ['clothes', 0],
      ['hair', 0],
      ['status', 0],
      ['behaviour', 1],
      ['reactions', 1],
    ]);
  });

  it('names and describes each in Title Case with no em dash', () => {
    for (const c of AVATAR_PALETTE_CATEGORIES) {
      expect(c.label).toBe(titleCase(c.label));
      expect(`${c.label} ${c.description}`).not.toMatch(/—/);
    }
  });
});

describe('titleCase', () => {
  it('capitalises every word but the short ones, leaving capitals alone', () => {
    expect(titleCase('Lab coat')).toBe('Lab Coat');
    expect(titleCase('Jumping jacks')).toBe('Jumping Jacks');
    expect(titleCase('T-shirt')).toBe('T-Shirt');
    expect(titleCase('In a Meeting')).toBe('In a Meeting');
    expect(titleCase('a top knot')).toBe('A Top Knot');
    expect(titleCase('Hawaiian')).toBe('Hawaiian');
  });
});

describe('behaviourStill', () => {
  it('freezes each Behaviour at the moment that says what it is, on the ground', () => {
    expect(behaviourStill('jumping-jacks')).toMatchObject({ armsOut: true, legsApart: true });
    expect(behaviourStill('wave').waveArm).toBe(true);
    expect(behaviourStill('cheer').armsUp).toBe(true);
    expect(behaviourStill('spin').facing).toBeDefined();
    expect(behaviourStill('dance').leanX).not.toBe(0);
    for (const r of AVATAR_REACTIONS) expect(behaviourStill(r.id).lift).toBe(0);
  });
});
