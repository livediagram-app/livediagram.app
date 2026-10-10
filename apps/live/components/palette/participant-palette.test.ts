import { describe, expect, it } from 'vitest';
import {
  PARTICIPANT_CANVAS_TOOLS,
  participantPaletteCategories,
  participantTiles,
} from './palette-layouts';
import { buildCanvasToolOptions } from './canvas-tool-options';

// A Participant's palette (docs/specs/013-workspace/share-roles.md): only what it may add.
describe('participantTiles', () => {
  const content = (t: { action: { type: string } }) =>
    t.action.type === 'sticky' || t.action.type === 'text';

  it('offers the Sticky and Text tiles on an ordinary diagram, then Image', () => {
    const tiles = participantTiles('diagram', false);
    expect(tiles.slice(0, -1).every(content)).toBe(true);
    expect(tiles.map((t) => t.action.type)).toContain('sticky');
    expect(tiles.at(-1)?.id).toBe('tools:image');
  });

  it("offers an Event Storming board's coloured notes, then Image", () => {
    const tiles = participantTiles('diagram', true);
    expect(tiles.length).toBeGreaterThan(2);
    expect(tiles.slice(0, -1).every((t) => t.action.type === 'sticky')).toBe(true);
    expect(tiles.at(-1)?.action.type).toBe('image');
  });

  it('offers something to add in every mode', () => {
    for (const mode of ['diagram', 'draw', 'illustrate', 'plan'] as const) {
      expect(participantTiles(mode, false).length).toBeGreaterThan(0);
    }
  });
});

describe('participantPaletteCategories', () => {
  it('is the one Participate category, holding the Participant tiles', () => {
    const [only, ...rest] = participantPaletteCategories('diagram', false);
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ id: 'participate', label: 'Participate' });
    expect(only?.tiles).toEqual(participantTiles('diagram', false));
  });
});

describe('PARTICIPANT_CANVAS_TOOLS', () => {
  it("names real selection modes, and none of an Editor's tools", () => {
    const ids = buildCanvasToolOptions({ isMobile: false, includeZen: true }).map((o) => o.id);
    for (const tool of PARTICIPANT_CANVAS_TOOLS) expect(ids).toContain(tool);
    for (const tool of ['eraser', 'format', 'slide-deck']) {
      expect(PARTICIPANT_CANVAS_TOOLS).not.toContain(tool);
    }
  });
});
