// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OffscreenContentHint } from './OffscreenContentHint';

// liveworkspace/docs/specs/016-notifications/callouts.md "Floating callouts": Nothing in view, one line, Show All.

afterEach(cleanup);

describe('OffscreenContentHint', () => {
  it('is one floating info callout, and Show All brings the tab back', () => {
    const fit = vi.fn();
    render(<OffscreenContentHint onBringBack={fit} />);
    const box = screen.getByRole('status');
    expect(box.getAttribute('data-callout')).toBe('info');
    expect(box.textContent).toBe('Nothing in viewShow All');
    fireEvent.click(screen.getByRole('button', { name: 'Show All' }));
    expect(fit).toHaveBeenCalledOnce();
  });
});
