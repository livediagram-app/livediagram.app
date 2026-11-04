// @vitest-environment jsdom

// Contents Options (docs/specs/007-editor/pages-mode.md "Contents"): Collapse Contents for everyone with Contents, and
// the tab's Stack Pages switch where the editor offers it (an Editor's).
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentsOptions } from './ContentsOptions';

afterEach(cleanup);

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Contents Options' }));

describe('ContentsOptions', () => {
  it('offers Collapse Contents alone without a stack switch (a Viewer, an article, livedesign)', () => {
    const onCollapse = vi.fn();
    render(<ContentsOptions onCollapse={onCollapse} />);
    open();
    expect(screen.queryByRole('menuitemcheckbox')).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Collapse Contents' }));
    expect(onCollapse).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('switches Stack Pages, saying whether it is on, and stays open as a switch does', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <ContentsOptions onCollapse={vi.fn()} stack={{ on: true, onToggle }} />,
    );
    open();
    const row = screen.getByRole('menuitemcheckbox', { name: /Stack Pages/ });
    expect(row.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<ContentsOptions onCollapse={vi.fn()} stack={{ on: false, onToggle }} />);
    expect(
      screen.getByRole('menuitemcheckbox', { name: /Stack Pages/ }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('shows the cog pressed while its menu is open', () => {
    render(<ContentsOptions onCollapse={vi.fn()} />);
    const cog = screen.getByRole('button', { name: 'Contents Options' });
    expect(cog.getAttribute('aria-expanded')).toBe('false');
    open();
    expect(cog.getAttribute('aria-expanded')).toBe('true');
  });
});
