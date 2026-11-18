// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The bar over the pages that stand in for a canvas (docs/specs/007-editor/editor-app.md "Header actions"): livediagram's logo to the
// Explorer and the account control. Its account control holds its glyph in the 20px icon slot every header action uses
// (docs/specs/004-interface-design/optical-alignment.md, "A stack row shares one line").
vi.mock('@liveworkspace/workbench/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => ({
    authLoaded: true,
    isSignedIn: true,
    user: { firstName: 'Webber', fullName: 'Webber Takken', email: 'w@example.com' },
    signOut: vi.fn(),
  }),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { EditorHeader } = await import('./EditorHeader');
const { HEADER_ICON_SLOT_PX } =
  await import('@liveworkspace/workbench/components/chrome/header-action');

afterEach(cleanup);

describe('EditorHeader', () => {
  it('holds the logo and the account control, and nothing of an open canvas', () => {
    const { container } = render(<EditorHeader />);
    expect(screen.getByRole('link', { name: 'livediagram' })).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Account menu',
    ]);
    expect(container.querySelector('input')).toBeNull();
  });

  it('draws the account avatar, its initial as a glyph disc filling the shared 20px slot', () => {
    render(<EditorHeader />);
    const slot = screen.getByRole('button', { name: 'Account menu' })
      .firstElementChild as HTMLElement;
    expect(slot.dataset.optical).toBe('slot');
    expect(slot.style.width).toBe(`${HEADER_ICON_SLOT_PX}px`);
    const disc = slot.firstElementChild as HTMLElement;
    expect(disc.dataset.optical).toBe('disc');
    expect(disc.style.width).toBe(`${HEADER_ICON_SLOT_PX}px`);
    expect(disc.querySelector('.text-optical-centre')?.textContent).toBe('WE');
  });
});

// In an editor the logo is a plain link to the Explorer, with no site switcher
// (liveworkspace/docs/specs/010-site/site-switcher.md "Where it shows").
describe('EditorHeader logo', () => {
  it('goes to the Explorer, not the homepage', () => {
    render(<EditorHeader />);
    expect(screen.getByRole('link', { name: 'livediagram' }).getAttribute('href')).toBe(
      '/explorer',
    );
  });

  it('is a plain link with no site switcher, on hover or click', () => {
    render(<EditorHeader />);
    const logo = screen.getByRole('link', { name: 'livediagram' });
    expect(logo.className).toContain('touch-target');
    expect(screen.queryByRole('button', { name: 'Switch site' })).toBeNull();
    fireEvent.mouseEnter(logo);
    fireEvent.pointerEnter(logo);
    expect(screen.queryByRole('menu', { name: 'liveworkspace sites' })).toBeNull();
    fireEvent.click(logo);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
