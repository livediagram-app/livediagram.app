// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ItemKeyTag, KEY_COPIED_MS } from './ItemPanelHeaderParts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ItemKeyTag', () => {
  let writeText: Mock<Clipboard['writeText']>;
  beforeEach(() => {
    writeText = vi.fn<Clipboard['writeText']>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('copies "#12" and flashes Copied, then reads as the copy button again', async () => {
    vi.useFakeTimers();
    render(<ItemKeyTag itemKey={12} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy card number #12' }));
    expect(writeText).toHaveBeenCalledWith('#12');
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Copied #12' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(KEY_COPIED_MS);
    });
    expect(screen.getByRole('button', { name: 'Copy card number #12' })).toBeTruthy();
  });

  it('does not flash when the clipboard refuses the write', async () => {
    writeText.mockImplementation(() => Promise.reject(new Error('blocked')));
    render(<ItemKeyTag itemKey={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy card number #3' }));
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Copied #3' })).toBeNull();
  });

  // docs/specs/004-interface-design/touch-targets.md: the tag is 22px tall, so on a touch screen its tap area
  // reaches 44px vertically (only: the type picker sits 8px to its left), from a positioned host.
  it('takes a 44px tap area on a touch screen', () => {
    render(<ItemKeyTag itemKey={5} />);
    const tag = screen.getByRole('button', { name: 'Copy card number #5' });
    expect(tag.className.split(' ')).toEqual(
      expect.arrayContaining(['relative', 'touch-target-y']),
    );
  });
});
