// @vitest-environment jsdom
// Element dialogs close when their element leaves the active tab, so none reopens by itself when it comes back.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livepages/document';
import { useCloseVanishedDialogs, type DialogFor } from './useCloseVanishedDialogs';

const el = (id: string) => ({ ...createShape('square', 0, 0), id }) as Element;

describe('useCloseVanishedDialogs', () => {
  it('closes only the dialogs whose element is gone, and none while their element stays', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    const closeIdle = vi.fn();
    const { rerender } = renderHook(
      ({ elements }: { elements: Element[] }) =>
        useCloseVanishedDialogs(elements, [
          ['a', closeA],
          ['b', closeB],
          [null, closeIdle],
        ] satisfies DialogFor[]),
      { initialProps: { elements: [el('a'), el('b')] } },
    );
    expect(closeA).not.toHaveBeenCalled();
    expect(closeB).not.toHaveBeenCalled();
    rerender({ elements: [el('a')] });
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
    expect(closeIdle).not.toHaveBeenCalled();
  });

  it('closes a dialog whose element is not on the tab it moves to', () => {
    const close = vi.fn();
    const { rerender } = renderHook(
      ({ elements }: { elements: Element[] }) => useCloseVanishedDialogs(elements, [['a', close]]),
      { initialProps: { elements: [el('a')] } },
    );
    rerender({ elements: [el('x')] });
    expect(close).toHaveBeenCalledTimes(1);
  });

  // Hidden by its own check (a lock, a role change), not by the element going: closed too, so it does not reopen
  // by itself when the lock or the role is undone.
  it('closes a dialog its own check stops showing while its element stays', () => {
    const close = vi.fn();
    let locked = false;
    const { rerender } = renderHook(
      ({ elements, gate }: { elements: Element[]; gate: string }) =>
        useCloseVanishedDialogs(elements, [['a', close, () => !locked]], gate),
      { initialProps: { elements: [el('a')], gate: 'edit' } },
    );
    expect(close).not.toHaveBeenCalled();
    // The session turns read-only: same elements, a new gate.
    locked = true;
    rerender({ elements: [el('a')], gate: 'view' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes a dialog whose element is no longer of its kind', () => {
    const close = vi.fn();
    const { rerender } = renderHook(
      ({ elements }: { elements: Element[] }) =>
        useCloseVanishedDialogs(elements, [['a', close, (e) => e.type === 'table']]),
      { initialProps: { elements: [{ ...el('a'), type: 'table' } as unknown as Element] } },
    );
    expect(close).not.toHaveBeenCalled();
    rerender({ elements: [el('a')] });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
