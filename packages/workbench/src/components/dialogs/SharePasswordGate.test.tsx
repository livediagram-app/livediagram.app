// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharePasswordGate } from './SharePasswordGate';

afterEach(() => cleanup());

// docs/specs/013-workspace/share-password.md: the gate names the file in the product's word.
describe('SharePasswordGate', () => {
  it('reads in the noun it is given', () => {
    render(<SharePasswordGate noun="plan" invalid={false} ownerName="Ada" onSubmit={() => {}} />);
    expect(screen.getByRole('heading', { name: 'This plan is password-protected' })).toBeTruthy();
    expect(screen.getByText('Enter the password Ada set to open this plan.')).toBeTruthy();
    expect(screen.getByLabelText('Plan password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open plan' })).toBeTruthy();
  });

  it('hands up the trimmed password, and flags a wrong one', () => {
    const onSubmit = vi.fn();
    render(<SharePasswordGate noun="design" invalid ownerName={null} onSubmit={onSubmit} />);
    expect(screen.getByText('Enter the password the owner set to open this design.')).toBeTruthy();
    expect(screen.getByText("That password didn't match. Try again.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Design password'), { target: { value: '  pw  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open design' }));
    expect(onSubmit).toHaveBeenCalledWith('pw');
  });
});
