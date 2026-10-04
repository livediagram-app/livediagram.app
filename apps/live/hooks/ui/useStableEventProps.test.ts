// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStableEventProps } from './useStableEventProps';

// docs/specs/008-canvas/blueprints/selection-store.md "The canvas boundary".

type Props = {
  onSave?: (n: number) => number;
  onClose?: () => void;
  resolve?: () => string;
  label: string;
};

describe('useStableEventProps', () => {
  it('keeps each event handler the same function across renders, calling the newest', () => {
    const first = vi.fn((n: number) => n + 1);
    const second = vi.fn((n: number) => n + 2);
    const { result, rerender } = renderHook((p: Props) => useStableEventProps(p), {
      initialProps: { onSave: first, label: 'a' },
    });
    const wrapper = result.current.onSave;

    rerender({ onSave: second, label: 'a' });

    expect(result.current.onSave).toBe(wrapper);
    expect(result.current.onSave!(1)).toBe(3);
    expect(first).not.toHaveBeenCalled();
  });

  it('passes every other prop through untouched, functions not named on… included', () => {
    const resolve = () => 'x';
    const { result } = renderHook(() => useStableEventProps<Props>({ resolve, label: 'b' }));

    expect(result.current.resolve).toBe(resolve);
    expect(result.current.label).toBe('b');
  });

  it('keeps an absent handler absent, and gives one that appears later its forwarder', () => {
    const onClose = vi.fn();
    const { result, rerender } = renderHook((p: Props) => useStableEventProps(p), {
      initialProps: { onClose: undefined, label: 'c' } as Props,
    });
    expect(result.current.onClose).toBeUndefined();

    rerender({ onClose, label: 'c' });
    const wrapper = result.current.onClose;
    result.current.onClose!();
    rerender({ onClose: vi.fn(), label: 'c' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.onClose).toBe(wrapper);
  });

  it('drops the forwarder while the handler is absent, and restores the same one', () => {
    const { result, rerender } = renderHook((p: Props) => useStableEventProps(p), {
      initialProps: { onClose: vi.fn(), label: 'd' } as Props,
    });
    const wrapper = result.current.onClose;

    rerender({ onClose: undefined, label: 'd' });
    expect(result.current.onClose).toBeUndefined();
    rerender({ onClose: vi.fn(), label: 'd' });

    expect(result.current.onClose).toBe(wrapper);
  });
});
