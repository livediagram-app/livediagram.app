// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { periodPhrase, VerifyPageButton } from './VerifyPageButton';

describe('Verify in the meta row', () => {
  it('explains verifying in a popover and verifies only on confirm', () => {
    const onVerify = vi.fn();
    render(<VerifyPageButton again={false} period="in 90 days" becomesOwner onVerify={onVerify} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    const pop = document.querySelector('[data-verify-popover]')!;
    expect(pop.textContent).toContain('Verify This Page?');
    expect(pop.textContent).toContain('comes due for review again in 90 days');
    expect(pop.textContent).toContain('you become its owner');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onVerify).not.toHaveBeenCalled();
    expect(document.querySelector('[data-verify-popover]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    const confirm = screen
      .getAllByRole('button', { name: 'Verify' })
      .find((b) => b.closest('[data-verify-popover]'))!;
    fireEvent.click(confirm);
    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-verify-popover]')).toBeNull();
  });

  it('reads Verify Again for a verified page, with no owner line and no period under Never', () => {
    render(<VerifyPageButton again period={undefined} becomesOwner={false} onVerify={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verify Again' }));
    const pop = document.querySelector('[data-verify-popover]')!;
    expect(pop.textContent).toContain('Verify This Page Again?');
    expect(pop.textContent).toContain('see it as Verified.');
    expect(pop.textContent).not.toContain('owner');
  });

  it('words the Review Period for the popover', () => {
    expect(periodPhrase(90)).toBe('in 90 days');
    expect(periodPhrase(365)).toBe('in a year');
    expect(periodPhrase('never')).toBeUndefined();
  });
});
