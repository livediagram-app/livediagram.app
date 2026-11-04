import { describe, expect, it } from 'vitest';
import { walkButtonShown } from './walk-button';

// docs/specs/008-canvas/avatar-mode.md "The Walk button": whoever has no palette strip gets it, where the surface walks.
describe('walkButtonShown', () => {
  it('shows for a read-only session with no palette strip of its own (a Viewer)', () => {
    expect(walkButtonShown({ offered: true, readOnly: true, participantPalette: false })).toBe(
      true,
    );
  });

  it('leaves it to the picker for an Editor and for a Participant with its palette', () => {
    expect(walkButtonShown({ offered: true, readOnly: false, participantPalette: false })).toBe(
      false,
    );
    expect(walkButtonShown({ offered: true, readOnly: true, participantPalette: true })).toBe(
      false,
    );
  });

  it('never shows where the surface does not walk (an embed)', () => {
    expect(walkButtonShown({ offered: false, readOnly: true, participantPalette: false })).toBe(
      false,
    );
  });
});
