// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeSnippet } from './CodeSnippet';

describe('CodeSnippet', () => {
  it('keeps a command’s prompt out of its text, so a copy of the block pastes as a command', () => {
    const { container } = render(<CodeSnippet lang="bash" code="claude mcp add livediagram" />);
    expect(container.querySelector('pre')!.textContent).toBe('claude mcp add livediagram');
  });

  it('hands onCopied to its copy button', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
    const onCopied = vi.fn();
    render(<CodeSnippet lang="json" code="{}" onCopied={onCopied} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy the config' }));
    });
    expect(onCopied).toHaveBeenCalledTimes(1);
  });

  it('wraps prose when asked, and scrolls a command by default', () => {
    const { container, rerender } = render(<CodeSnippet lang="text" code="a prompt" wrap />);
    expect(container.querySelector('pre')!.className).toContain('whitespace-pre-wrap');
    rerender(<CodeSnippet lang="bash" code="claude" />);
    expect(container.querySelector('pre')!.className).not.toContain('whitespace-pre-wrap');
  });
});
