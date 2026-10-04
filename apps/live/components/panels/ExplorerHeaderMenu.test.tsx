// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExplorerHeaderMenu } from './ExplorerHeaderMenu';

// jsdom lays nothing out, so the keep-on-screen clamp would chase a box that
// never moves. Where the menu sits is not what this file is about.
vi.mock('@/lib/clamp-to-viewport', () => ({ clampToViewport: () => ({ x: 0, y: 0 }) }));

afterEach(() => {
  vi.restoreAllMocks();
});

function openMenu() {
  render(<ExplorerHeaderMenu actions={{ onOpenSettings: () => {} }} />);
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
}

describe('ExplorerHeaderMenu', () => {
  // Third-party licences (docs/specs/002-project-scope/third-party-licences.md).
  it('offers Licences beside GitHub in the app band', () => {
    openMenu();
    const menu = screen.getByRole('menu');
    const rows = within(menu)
      .getAllByRole('menuitem')
      .map((row) => row.textContent);
    const github = rows.indexOf('GitHub');
    expect(github).toBeGreaterThan(-1);
    expect(rows[github + 1]).toBe('Licences');
  });

  it('opens the licences page in a new tab, as GitHub does', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openMenu();
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Licences' }));
    expect(open).toHaveBeenCalledWith('/licences', '_blank', 'noopener,noreferrer');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
