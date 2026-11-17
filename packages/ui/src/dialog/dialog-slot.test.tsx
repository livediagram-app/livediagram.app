// @vitest-environment jsdom
// The slot a tool's dialog renders into inside the footer's Tools (liveworkspace/docs/specs/004-index/
// footer-tools-menu.md "Opening a tool inside Tools"; blueprint FM6).
import { StrictMode } from 'react';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';
import {
  closeDialogSlot,
  holdDialogSlot,
  leaveToolsWithDialog,
  openDialogSlot,
  resetDialogSlot,
  setDialogSlotNode,
  useDialogSlot,
} from './dialog-slot';

afterEach(() => {
  cleanup();
  resetDialogSlot();
});

function slotNode() {
  const node = document.createElement('div');
  document.body.append(node);
  return node;
}

describe('the dialog slot', () => {
  it('is claimed by the next dialog, which draws inside it as a region and lets go as it closes', () => {
    const slot = renderHook(() => useDialogSlot());
    let at = 0;
    act(() => {
      at = openDialogSlot();
    });
    const node = slotNode();
    act(() => setDialogSlotNode(at, node));
    const { rerender } = render(
      <Dialog open onClose={vi.fn()} ariaLabel="Tool" size="lg">
        <p>Inside</p>
      </Dialog>,
    );
    expect(node.contains(screen.getByRole('region', { name: 'Tool' }))).toBe(true);
    expect(slot.result.current?.claimed?.size).toBe('lg');
    rerender(
      <Dialog open={false} onClose={vi.fn()} ariaLabel="Tool">
        <p>Inside</p>
      </Dialog>,
    );
    expect(slot.result.current?.released).toBe(true);
    // A dialog after that is modal again: the slot was this one's.
    render(
      <Dialog open onClose={vi.fn()} ariaLabel="Next">
        <p>Modal</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Next' })).toBeTruthy();
    act(() => closeDialogSlot(at));
    expect(slot.result.current).toBeNull();
  });

  it('stays claimed under StrictMode, whose mount releases and claims again at once (the dev servers)', () => {
    const slot = renderHook(() => useDialogSlot());
    let at = 0;
    act(() => {
      at = openDialogSlot();
    });
    const node = slotNode();
    act(() => setDialogSlotNode(at, node));
    render(
      <StrictMode>
        <Dialog open onClose={vi.fn()} ariaLabel="Tool" size="lg">
          <p>Inside</p>
        </Dialog>
      </StrictMode>,
    );
    expect(node.contains(screen.getByRole('region', { name: 'Tool' }))).toBe(true);
    expect(slot.result.current?.released).toBe(false);
    expect(slot.result.current?.claimed?.size).toBe('lg');
  });

  it('is held for the dialog that follows a gate, and the hold undoes', () => {
    const slot = renderHook(() => useDialogSlot());
    expect(holdDialogSlot()()).toBeUndefined();
    let at = 0;
    act(() => {
      at = openDialogSlot();
    });
    act(() => setDialogSlotNode(at, slotNode()));
    const { rerender } = render(
      <Dialog open onClose={vi.fn()} ariaLabel="Gate">
        <p>x</p>
      </Dialog>,
    );
    let undo = () => {};
    act(() => {
      undo = holdDialogSlot();
    });
    expect(slot.result.current?.held).toBe(true);
    act(() => undo());
    expect(slot.result.current?.held).toBe(false);
    act(() => {
      holdDialogSlot();
    });
    rerender(
      <Dialog open={false} onClose={vi.fn()} ariaLabel="Gate">
        <p>x</p>
      </Dialog>,
    );
    render(
      <Dialog open onClose={vi.fn()} ariaLabel="Tool">
        <p>x</p>
      </Dialog>,
    );
    expect(screen.getByRole('region', { name: 'Tool' })).toBeTruthy();
    expect(slot.result.current?.held).toBe(false);
  });

  it('marks a dialog leaving for the whole window, once', () => {
    const slot = renderHook(() => useDialogSlot());
    act(() => leaveToolsWithDialog());
    expect(slot.result.current).toBeNull();
    let at = 0;
    act(() => {
      at = openDialogSlot();
    });
    act(() => setDialogSlotNode(at, slotNode()));
    render(
      <Dialog open onClose={vi.fn()} ariaLabel="Tool">
        <p>x</p>
      </Dialog>,
    );
    act(() => leaveToolsWithDialog());
    const first = slot.result.current;
    expect(first?.leaving).toBe(true);
    act(() => leaveToolsWithDialog());
    expect(slot.result.current).toBe(first);
  });
});
