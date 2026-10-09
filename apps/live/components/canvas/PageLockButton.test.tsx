// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageLockButton, pageLockRoom } from './PageLockButton';

// docs/specs/007-editor/illustrate-pages.md "Locking a page": the padlock before the cog.
afterEach(() => cleanup());

describe('PageLockButton', () => {
  it('locks an open page and unlocks a locked one, named Locked on a desktop', () => {
    const onToggle = vi.fn();
    render(<PageLockButton locked={false} labelled onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lock page' }));
    expect(onToggle).toHaveBeenCalled();
    cleanup();
    render(<PageLockButton locked labelled onToggle={vi.fn()} />);
    const b = screen.getByRole('button', { name: 'Unlock page' });
    expect(b.hasAttribute('aria-pressed')).toBe(false);
    expect(b.textContent).toContain('Locked');
    expect(pageLockRoom(true, true)).toBeGreaterThan(pageLockRoom(true, false));
  });
});
