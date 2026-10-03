// @vitest-environment jsdom

// The Undo / Redo strip in the bottom-right cluster: two buttons, each
// wired to its handler and disabled when there is nothing to undo / redo.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UndoRedoClusterStrip } from './UndoRedoClusterStrip';

afterEach(cleanup);

describe('UndoRedoClusterStrip', () => {
  it('runs Undo and Redo from their buttons', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(<UndoRedoClusterStrip onUndo={onUndo} onRedo={onRedo} canUndo canRedo />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it('disables a button with nothing to do', () => {
    render(<UndoRedoClusterStrip canUndo={false} canRedo={false} />);
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('carries no Tab Activity button', () => {
    render(<UndoRedoClusterStrip canUndo canRedo />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
