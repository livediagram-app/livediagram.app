import { describe, expect, it } from 'vitest';
import { PARTICIPANT_CANVAS_TOOLS } from './palette-layouts';
import { CANVAS_TOOLS } from '@/lib/editor-commands';

describe('PARTICIPANT_CANVAS_TOOLS', () => {
  // The two sides of the Edit | Walk toggle, and nothing else: neither writes, so a read-only Editor presses both
  // (docs/specs/013-workspace/share-roles.md, docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle").
  it('names the toggle sides Search offers, Avatar included', () => {
    const ids = CANVAS_TOOLS.map((t) => t.id);
    for (const tool of PARTICIPANT_CANVAS_TOOLS) expect(ids).toContain(tool);
    expect(PARTICIPANT_CANVAS_TOOLS).toContain('avatar');
    expect(PARTICIPANT_CANVAS_TOOLS).not.toContain('format');
  });
});
