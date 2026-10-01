// @vitest-environment jsdom

// The Activity strip without its panel (docs/specs/007-editor/user-preferences.md): with the Activity
// panel off in Settings the strip is Undo and Redo alone, still working.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityClusterStrip } from './ActivityClusterStrip';

afterEach(cleanup);

describe('ActivityClusterStrip', () => {
  it('carries the Tab Activity button by default', () => {
    render(<ActivityClusterStrip popoverOpen={false} canUndo canRedo />);
    expect(screen.getByRole('button', { name: 'Open Tab Activity' })).toBeTruthy();
  });

  it('drops the Tab Activity button while the panel is off, keeping Undo and Redo', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <ActivityClusterStrip
        showActivity={false}
        popoverOpen={false}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo
        canRedo
      />,
    );
    expect(screen.queryByRole('button', { name: 'Open Tab Activity' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
  });
});
