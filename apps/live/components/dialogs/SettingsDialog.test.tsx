// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsDialog } from './SettingsDialog';
import { visibleCategories } from './settings/settings-catalogue';
import type { UserPreferences } from '@/lib/user-preferences';

// The dialog takes BOTH iOS Settings shapes, one per viewport (docs/specs/007-editor/user-preferences.md): the
// iPad split view on desktop, the iPhone push navigation on a phone. Which
// one renders is the whole point of the rework, and it hangs off a media
// query, so it is worth pinning that a phone never shows the rail and a
// pane at once, and that a desktop always shows both.
function setViewport(mobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mobile,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function renderDialog(overrides: Partial<UserPreferences> = {}) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  render(
    <SettingsDialog
      settings={overrides as UserPreferences}
      onChange={onChange}
      onClose={onClose}
      aiCapable
    />,
  );
  return { onChange, onClose };
}

const FIRST_CATEGORY = visibleCategories(true, { emailEnabled: true, signedIn: false })[0]!;

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe('SettingsDialog', () => {
  it('opens on desktop with the rail and the first category already showing', () => {
    setViewport(false);
    renderDialog();
    // Rail.
    expect(screen.getByRole('button', { name: 'Privacy' })).toBeTruthy();
    // ...and the first category's pane beside it, with no tap needed. Which
    // category that is belongs to the catalogue, not to this test.
    expect(screen.getByText(FIRST_CATEGORY.rows[0]!.label)).toBeTruthy();
    // Nothing to go back to: the rail never left.
    expect(screen.queryByRole('button', { name: /^Settings$/ })).toBeNull();
  });

  it('swaps the pane when another category is picked, keeping the rail', () => {
    setViewport(false);
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    expect(screen.getByRole('switch', { name: 'Send Anonymous Usage Events' })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Quick-Add on Hover' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Editor' })).toBeTruthy();
  });

  it('opens on a phone at the root list, with no pane showing', () => {
    setViewport(true);
    renderDialog();
    expect(screen.getByRole('button', { name: 'Editor' })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Quick-Add on Hover' })).toBeNull();
  });

  it('opens on a named category when one is asked for', () => {
    // The `?settings=` deep link, which mail and the account menu use.
    setViewport(false);
    render(
      <SettingsDialog
        settings={{} as UserPreferences}
        onChange={() => {}}
        onClose={() => {}}
        aiCapable
        initialCategoryId="privacy"
      />,
    );
    expect(screen.getByRole('switch', { name: 'Send Anonymous Usage Events' })).toBeTruthy();
  });

  it('pushes a pane on a phone and comes back to the root list', () => {
    setViewport(true);
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Editor' }));
    expect(screen.getByRole('switch', { name: 'Quick-Add on Hover' })).toBeTruthy();
    // The rail is gone: a phone shows one screen at a time.
    expect(screen.queryByRole('button', { name: 'Privacy' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Privacy' })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Quick-Add on Hover' })).toBeNull();
  });

  it('writes the flipped preference through the catalogue', () => {
    setViewport(false);
    const { onChange } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Editor' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Quick-Add on Hover' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ quickAddOnHover: true }));
  });

  it('arms the welcome tour it promises when the row is left on', () => {
    // The row reads `tourSeen !== true` and says the tour will be offered
    // next time, but TourHost also needs the per-tab pending flag, which
    // only /new sets. Without arming it here the row sat on, promising a
    // tour that never came.
    setViewport(false);
    renderDialog({ tourSeen: false });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(sessionStorage.getItem('livediagram:v2:tour-pending')).toBe('1');
  });

  it('does not arm the tour once it has been taken', () => {
    setViewport(false);
    renderDialog({ tourSeen: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(sessionStorage.getItem('livediagram:v2:tour-pending')).toBeNull();
  });

  it('describes each switch with its own footnote, for screen readers too', () => {
    setViewport(false);
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Editor' }));
    const sw = screen.getByRole('switch', { name: 'Alignment Guides' });
    const describedBy = sw.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toContain('snap lines');
  });
});
