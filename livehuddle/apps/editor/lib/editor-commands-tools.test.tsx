// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditWalkToggle } from '@/components/palette/EditWalkToggle';
import {
  CANVAS_TOOLS,
  buildEditorCommands,
  type CommandContext,
  type CommandHandlers,
} from './editor-commands';

// Drift guard, in its own .tsx file because it renders the Edit | Walk toggle and the rest of
// editor-commands.test.ts is plain TS.
//
// Search's tool commands restate the toggle's two sides (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk
// toggle"). If a side is renamed in one place only, Search names it differently from the button it stands for. This
// test is the reason that can't happen quietly.

afterEach(cleanup);

const ctx: CommandContext = {
  isReadOnly: false,
  canUndo: false,
  canRedo: false,
  selectionCount: 0,
  singleRotates: false,
  singleIsShape: false,
  hasAnimation: false,
  marker: null,
  canShare: true,
  isOffline: false,
  // A tool neither side is, so both are offered.
  canvasTool: 'pan',
};

const noop = () => new Proxy({}, { get: () => vi.fn() }) as unknown as CommandHandlers;

describe('tool commands against the Edit | Walk toggle', () => {
  it('names the two sides as the toggle does, Edit then Walk', () => {
    render(<EditWalkToggle walking={false} onEdit={vi.fn()} onWalk={vi.fn()} />);
    const sides = within(screen.getByRole('group', { name: 'Edit or Walk' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(CANVAS_TOOLS.map((t) => t.name)).toEqual(sides);
  });

  it('switches to the tool each side stands for: Edit selects, Walk walks', () => {
    const cmds = buildEditorCommands(ctx, noop()).filter((c) => c.id.startsWith('tool:'));
    expect(cmds.map((c) => [c.name, c.id])).toEqual([
      ['Edit', 'tool:select'],
      ['Walk', 'tool:avatar'],
    ]);
  });
});
