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
  selectionCount: 0,
  singleIsBoxed: false,
  singleRotates: false,
  singleIsShape: false,
  hasAnimation: false,
  marker: null,
  canShare: true,
  isOffline: false,
  // A tool nothing else uses, so every real tool is offered.
  canvasTool: 'none',
  canvasEmpty: false,
};

const noop = () => new Proxy({}, { get: () => vi.fn() }) as unknown as CommandHandlers;

const toolIds = (c: CommandContext) =>
  buildEditorCommands(c, noop())
    .map((cmd) => cmd.id)
    .filter((id) => id.startsWith('tool:'))
    .map((id) => id.slice('tool:'.length))
    .sort();

describe('tool commands against the palette dropdown', () => {
  it('covers every tool the dropdown offers', () => {
    const dropdown = buildCanvasToolOptions({})
      .map((o) => o.id)
      .sort();
    expect(toolIds(ctx)).toEqual(dropdown);
  });

  it('matches the dropdown on which tools an empty canvas disables', () => {
    const enabled = buildCanvasToolOptions({ canvasEmpty: true })
      .filter((o) => !o.disabled)
      .map((o) => o.id)
      .sort();
    expect(toolIds({ ...ctx, canvasEmpty: true })).toEqual(enabled);
  });
});
