import { describe, expect, it } from 'vitest';
import {
  PARTICIPANT_CANVAS_TOOLS,
  participantPaletteCategories,
  participantTiles,
} from './palette-layouts';
import { buildCanvasToolOptions } from './canvas-tool-options';
import { CANVAS_TOOLS } from '@/lib/editor-commands';

// A Participant's palette (docs/specs/013-workspace/share-roles.md): only what it may add.
describe('participantTiles', () => {
  const content = (t: { action: { type: string } }) =>
    t.action.type === 'sticky' || t.action.type === 'text';

  it('offers the Sticky and Text tiles, then Image', () => {
    const tiles = participantTiles();
    expect(tiles.slice(0, -1).every(content)).toBe(true);
    expect(tiles.map((t) => t.action.type)).toContain('sticky');
    expect(tiles.at(-1)?.id).toBe('tools:image');
  });

});

describe('participantPaletteCategories', () => {
  it('is the one Participate category, holding the Participant tiles', () => {
    const [only, ...rest] = participantPaletteCategories();
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ id: 'participate', label: 'Participate' });
    expect(only?.tiles).toEqual(participantTiles());
  });
});

describe('PARTICIPANT_CANVAS_TOOLS', () => {
  // Locks the role in as tools are added: a tool that changes the board (`mutates` in the command catalogue) is an
  // Editor's, so it can never reach a Participant's selection modes (docs/specs/013-workspace/share-roles.md).
  it('holds no tool that changes the board', () => {
    const mutating = CANVAS_TOOLS.filter((t) => t.mutates).map((t) => t.id);
    expect(mutating.length).toBeGreaterThan(0);
    for (const tool of mutating) expect(PARTICIPANT_CANVAS_TOOLS).not.toContain(tool);
  });

  it("names real selection modes, and none of an Editor's tools", () => {
    const ids = buildCanvasToolOptions({
      isMobile: false,
      includeZen: true,
      // Avatar is listed while in force (docs/specs/008-canvas/avatar-mode.md "Where it lives").
      currentTool: 'avatar',
    }).map((o) => o.id);
    for (const tool of PARTICIPANT_CANVAS_TOOLS) expect(ids).toContain(tool);
    for (const tool of ['eraser', 'format', 'slide-deck']) {
      expect(PARTICIPANT_CANVAS_TOOLS).not.toContain(tool);
    }
  });
});
