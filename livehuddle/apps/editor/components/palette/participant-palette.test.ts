import { describe, expect, it } from 'vitest';
import { PARTICIPANT_CANVAS_TOOLS } from './palette-layouts';
import { buildCanvasToolOptions } from './canvas-tool-options';
import { CANVAS_TOOLS } from '@/lib/editor-commands';

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
