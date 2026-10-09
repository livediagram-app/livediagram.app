import { describe, expect, it } from 'vitest';
import { participantTiles } from './ParticipantToolbar';

// A Participant's palette (docs/specs/013-workspace/share-roles.md): only what it may add.
describe('participantTiles', () => {
  it('offers the Sticky and Text tiles on an ordinary diagram', () => {
    const tiles = participantTiles('diagram', false);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.action.type === 'sticky' || t.action.type === 'text')).toBe(true);
    expect(tiles.map((t) => t.action.type)).toContain('sticky');
  });

  it("offers an Event Storming board's coloured notes", () => {
    const tiles = participantTiles('diagram', true);
    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles.every((t) => t.action.type === 'sticky')).toBe(true);
  });

  it('offers something to add in every mode', () => {
    for (const mode of ['diagram', 'draw', 'illustrate', 'plan'] as const) {
      expect(participantTiles(mode, false).length).toBeGreaterThan(0);
    }
  });
});
