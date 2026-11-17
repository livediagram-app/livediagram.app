import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordSection } from './PasswordSection';

afterEach(() => vi.useRealTimers());

// The "Saved" flash clears itself after 1.5 s; closing the dialog first must cancel that, or the timer fires on an
// unmounted section (after a test's teardown it threw "window is not defined").
describe('PasswordSection', () => {
  it('cancels the Saved flash timer when it unmounts', async () => {
    vi.useFakeTimers();
    const onSet = vi.fn(async () => true);
    const { container, unmount } = render(
      <PasswordSection passwordSet={false} busy={false} onSet={onSet} />,
    );
    fireEvent.click(screen.getByRole('switch'));
    // Opening the field focuses it on the next frame; let that run so the only timer left is the flash's.
    act(() => vi.runOnlyPendingTimers());
    fireEvent.change(container.querySelector('input:not([role])') as HTMLInputElement, {
      target: { value: 'correct horse' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Save/ }));
    });
    expect(onSet).toHaveBeenCalledWith('correct horse');
    // Let the frame-later focus moves run, short of the flash's 1.5 s.
    act(() => vi.advanceTimersByTime(100));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    // Unmounting removes the focused field, so jsdom runs its focus fixup on the next frame; let that one go.
    act(() => vi.advanceTimersByTime(20));
    expect(vi.getTimerCount()).toBe(0);
  });

  // Work Tracker 1023: Password Set, the field and the lock's reason hung outside the card on a guide rule.
  it('keeps Password Set, the new password field and the lock reason inside the Password Protection card', () => {
    const card = () => screen.getByText('Password Protection').closest('.rounded-xl')!;
    const { rerender } = render(<PasswordSection passwordSet busy={false} onSet={vi.fn()} />);
    expect(card().contains(screen.getByText('Password Set'))).toBe(true);
    expect(card().contains(screen.getByRole('button', { name: 'Remove' }))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(card().contains(screen.getByRole('textbox', { name: 'Share password' }))).toBe(true);
    rerender(
      <PasswordSection
        passwordSet={false}
        busy={false}
        lockedReason="A listed post can't have a password."
        onSet={vi.fn()}
      />,
    );
    expect(card().contains(screen.getByText("A listed post can't have a password."))).toBe(true);
  });
});
