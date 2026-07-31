import { describe, expect, it, vi } from 'vitest';

import { buildCanvasToolOptions } from '@/components/palette/canvas-tool-options';
import { buildEditorCommands, type CommandContext, type CommandHandlers } from './editor-commands';

// Drift guard, in its own .tsx file because buildCanvasToolOptions returns
// React icons and the rest of editor-commands.test.ts is plain TS.
//
// The tool commands restate the dropdown's ids. If a tool is renamed or added
// in one place only, search either misses it or hands the setter an id that
// does not exist and silently does nothing. This test is the reason that can't
// happen quietly.

const ctx: CommandContext = {
  isReadOnly: false,
  canUndo: false,
  canRedo: false,
  zenMode: false,
  selectionCount: 0,
  singleIsBoxed: false,
  singleIsShape: false,
  hasAnimation: false,
  marker: null,
  isOwner: true,
  isOffline: false,
  // A tool nothing else uses, so every real tool is offered.
  canvasTool: 'none',
  canvasEmpty: false,
  isMobile: false,
};

const noop = () => new Proxy({}, { get: () => vi.fn() }) as unknown as CommandHandlers;

describe('tool commands against the palette dropdown', () => {
  it('covers every tool the dropdown offers', () => {
    const dropdown = buildCanvasToolOptions({ isMobile: false, includeZen: true })
      .map((o) => o.id)
      // Zen is an ACTION in the dropdown, not a tool, and it already has its
      // own command ('zen'), so it is not expected under the tool: prefix.
      .filter((id) => id !== 'zen');
    const commands = buildEditorCommands(ctx, noop())
      .map((c) => c.id)
      .filter((id) => id.startsWith('tool:'))
      .map((id) => id.slice('tool:'.length));
    expect(commands).toEqual(dropdown);
  });

  it('matches the dropdown on the mobile carve-out too', () => {
    const dropdown = buildCanvasToolOptions({ isMobile: true, includeZen: false }).map((o) => o.id);
    const commands = buildEditorCommands({ ...ctx, isMobile: true }, noop())
      .map((c) => c.id)
      .filter((id) => id.startsWith('tool:'))
      .map((id) => id.slice('tool:'.length));
    expect(commands).toEqual(dropdown);
  });

  it('matches the dropdown on which tools an empty canvas disables', () => {
    const enabled = buildCanvasToolOptions({ isMobile: false, canvasEmpty: true })
      .filter((o) => !o.disabled)
      .map((o) => o.id);
    const commands = buildEditorCommands({ ...ctx, canvasEmpty: true }, noop())
      .map((c) => c.id)
      .filter((id) => id.startsWith('tool:'))
      .map((id) => id.slice('tool:'.length));
    expect(commands).toEqual(enabled);
  });
});
