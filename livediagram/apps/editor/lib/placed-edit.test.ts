import { describe, expect, it } from 'vitest';
import { leaveByEscape, markPlacedEdit, takeEscapedPlacedEdit } from './placed-edit';

// docs/specs/008-canvas/canvas-and-palette.md "Labels": Escape out of the editor a placement opened.

describe('placed edit', () => {
  it('says a commit is Escape leaving the editor a placement opened', () => {
    markPlacedEdit('a');
    let escaped = false;
    leaveByEscape(() => {
      escaped = takeEscapedPlacedEdit('a');
    });
    expect(escaped).toBe(true);
  });

  it('is not Escape when the editor is left another way, and the mark goes with that commit', () => {
    markPlacedEdit('a');
    expect(takeEscapedPlacedEdit('a')).toBe(false);
    let escaped = true;
    leaveByEscape(() => {
      escaped = takeEscapedPlacedEdit('a');
    });
    expect(escaped).toBe(false);
  });

  it('never answers for another element, and keeps the mark for its own', () => {
    markPlacedEdit('a');
    let other = true;
    let own = false;
    leaveByEscape(() => {
      other = takeEscapedPlacedEdit('b');
      own = takeEscapedPlacedEdit('a');
    });
    expect(other).toBe(false);
    expect(own).toBe(true);
  });

  it('stops saying Escape once the commit is over, even when it throws', () => {
    markPlacedEdit('a');
    expect(() =>
      leaveByEscape(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(takeEscapedPlacedEdit('a')).toBe(false);
  });
});
