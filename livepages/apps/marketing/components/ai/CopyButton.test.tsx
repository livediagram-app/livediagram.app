// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopyButton } from './CopyButton';

// docs/specs/019-marketing/build-with-ai.md "Behaviour": copy, flash "Copied", announce it politely.
describe('CopyButton', () => {
  it('names itself starting with the words it shows', () => {
    render(<CopyButton text="x" label="Copy prompt" what="Build a deck" />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Copy prompt: Build a deck');
    render(<CopyButton text="x" what="the address" />);
    expect(screen.getByRole('button', { name: 'Copy the address' })).toBeTruthy();
  });

  it('announces the copy from a live region beside the button, not inside it', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
    render(<CopyButton text="https://example.com/mcp" what="the address" />);
    const button = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(button);
    });
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Copied the address');
    expect(button.contains(status)).toBe(false);
  });

  it('takes the compact size as its own, not as a class that loses to its padding', () => {
    render(<CopyButton text="x" what="the command" size="xs" />);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('py-1 ');
    expect(cls).not.toContain('py-1.5');
  });
});
