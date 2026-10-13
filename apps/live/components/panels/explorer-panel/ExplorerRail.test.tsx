// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExplorerRail } from './ExplorerRail';
import { panelSectionGroups, type PanelSection } from './panel-sections';

// docs/specs/013-workspace/explorer-structure.md "The rail" and "Keyboard and ARIA".
const groups = panelSectionGroups({ teams: [{ id: 't1' }], hasBrowserDocuments: true });

function show(
  over: { phone?: boolean; selected?: PanelSection; divider?: 'titles' | 'separators' } = {},
) {
  const onPick = vi.fn();
  render(
    <ExplorerRail
      groups={groups}
      selected={over.selected ?? { kind: 'mine' }}
      onPick={onPick}
      badges={{ shared: 2, browser: 3 }}
      teamName={(id) => (id === 't1' ? 'Design guild' : undefined)}
      divider={over.divider ?? 'titles'}
      phone={over.phone ?? false}
    />,
  );
  return onPick;
}

afterEach(cleanup);

describe('ExplorerRail', () => {
  it('lists every section under its group, the picked one current', () => {
    show();
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Overview',
      'Spaces',
      'More',
    ]);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([
      'Home',
      'Inbox',
      'Timeline',
      'Shared with me (2)',
      'My documents',
      'Design guild',
      'This browser (3)',
      'Library',
      'Trash',
    ]);
    expect(screen.getByRole('button', { name: 'My documents' }).getAttribute('aria-current')).toBe(
      'true',
    );
  });

  it('picks a section, never leaving the editor', () => {
    const onPick = show();
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(onPick).toHaveBeenCalledWith({ kind: 'timeline' });
  });

  it('moves between entries with Up and Down on a desktop, Left and Right on a phone', () => {
    show();
    const home = screen.getByRole('button', { name: 'Home' });
    home.focus();
    fireEvent.keyDown(home, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Inbox' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Trash' }));
    cleanup();
    show({ phone: true });
    const first = screen.getByRole('button', { name: 'Home' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Inbox' }));
  });

  it('is a row of chips on a phone, without group titles', () => {
    show({ phone: true });
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Home' }).className).toContain('h-11');
  });

  it('swaps titles for hairlines under Minimal chrome', () => {
    const { container } = render(<div />);
    show({ divider: 'separators' });
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    expect(container).toBeTruthy();
  });
});
