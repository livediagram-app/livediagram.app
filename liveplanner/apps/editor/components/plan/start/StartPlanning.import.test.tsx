// @vitest-environment jsdom

// Import on Start Planning's rail (docs/specs/026-plan/plan-mode.md "Starting a board"): an Editor's entry directly
// below Connect File, in the same foot group, opening the Import dialog and placing nothing; a Participant or Viewer
// sees none. A search still finds the Import card by the tools' names.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCommunityEnabledForTests } from '@liveworkspace/community-ui';
import { resetCommunityStartForTests } from '@liveworkspace/community-ui/start';
import { startPanelIsOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { StartPlanning } from './StartPlanning';

vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// Connect File where connecting can work (useConnectStart): offered unless a test takes it away.
let connectOffered = true;
vi.mock('@/components/connect/useConnectStart', () => ({
  useConnectStart: () => (connectOffered ? () => <p>Connect list</p> : undefined),
}));

beforeEach(() => {
  connectOffered = true;
  resetCommunityStartForTests();
  resetCommunityEnabledForTests();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ categories: {}, communityEnabled: false })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// EditorStartPanels gives `onImport` only when `trackerImport.canImport` (an Editor's: `!isStructureReadOnly`), so a
// Participant's and a Viewer's Start Planning has none.
const ROLES = { editor: true, participant: false, viewer: false } as const;

const mount = (canImport: boolean) => {
  const onImport = vi.fn();
  const onPickBoard = vi.fn();
  render(<StartPlanning onPickBoard={onPickBoard} onImport={canImport ? onImport : undefined} />);
  return { onImport, onPickBoard };
};

const rail = () => screen.getByRole('navigation', { name: 'Categories' });
const railIds = () =>
  [...rail().querySelectorAll<HTMLElement>('[data-rail]')].map((b) => b.dataset.rail);
const importEntry = () => within(rail()).getByRole('button', { name: 'Import' });
const search = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: /Find a board/ }), { target: { value } });

describe('Start Planning: Import on the rail', () => {
  it('is the entry directly above Connect File, in its foot group, Connect File the last chip and Tab stop', () => {
    mount(ROLES.editor);
    const connect = within(rail()).getByRole('button', { name: 'Connect File' });
    const entry = importEntry();
    // One group at the rail's foot, Import before Connect File: the DOM order is the phone's chips' and the Tab order.
    expect(entry.parentElement).toBe(connect.parentElement);
    expect(entry.nextElementSibling).toBe(connect);
    expect(railIds().slice(-2)).toEqual(['import', 'connect']);
    expect(entry.tabIndex).toBe(0);
    // Drawn like Connect File's row: the glyph, then its name on one line; heading the group here (no Describe a
    // Plan), with Connect File a rail gap under it.
    expect(entry.textContent).toBe('Import');
    expect(entry.querySelector('svg')).not.toBeNull();
    expect(connect.className).toContain('sm:mt-1');
    expect(entry.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('opens the Import dialog and places nothing, the grid keeping what it shows', () => {
    const { onImport, onPickBoard } = mount(ROLES.editor);
    fireEvent.click(importEntry());
    expect(onImport).toHaveBeenCalledOnce();
    expect(onPickBoard).not.toHaveBeenCalled();
    expect(importEntry().getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('region', { name: 'Recommended' })).toBeTruthy();
  });

  it('is no longer a Recommended card', () => {
    mount(ROLES.editor);
    const recommended = screen.getByRole('region', { name: 'Recommended' });
    expect(within(recommended).queryByText(/Bring work in from Trello/)).toBeNull();
    // The three boards this mount offers, and nothing after them.
    expect(
      [...recommended.querySelectorAll<HTMLElement>('[data-start-card]')].map(
        (c) => c.dataset.startCard,
      ),
    ).toEqual(['board:roadmap', 'board:kanban', 'board:todo']);
  });

  it('stands alone under the hairline where Connect File is not offered', () => {
    connectOffered = false;
    mount(ROLES.editor);
    expect(within(rail()).queryByRole('button', { name: 'Connect File' })).toBeNull();
    const entry = importEntry();
    expect(railIds().at(-1)).toBe('import');
    expect(entry.className).not.toContain('sm:mt-1');
    expect(entry.parentElement!.className).toContain('sm:border-t');
  });

  it.each(['participant', 'viewer'] as const)(
    'shows a %s no Import entry and no Import card',
    (role) => {
      mount(ROLES[role]);
      expect(within(rail()).queryByRole('button', { name: 'Import' })).toBeNull();
      // Connect File stays as it is, alone at the foot.
      const connect = within(rail()).getByRole('button', { name: 'Connect File' });
      expect(connect.nextElementSibling).toBeNull();
      search('trello');
      expect(screen.queryByRole('region', { name: 'Import' })).toBeNull();
    },
  );

  it.each(['import', 'Trello', 'asana', 'Jira', 'linear'])(
    'is found by a search for %s, its card opening the dialog',
    (q) => {
      const { onImport } = mount(ROLES.editor);
      search(q);
      const card = document.querySelector<HTMLElement>('[data-start-card="import"]');
      expect(card).not.toBeNull();
      fireEvent.click(card!);
      expect(onImport).toHaveBeenCalledOnce();
    },
  );
});

// Work Tracker 784: the new version prompt stands over the phone sheet while it is up (new-version-prompt.md).
describe('Start Planning on screen', () => {
  it('says the start panel is open while it shows, and closed once it goes', () => {
    const view = render(<StartPlanning onPickBoard={vi.fn()} />);
    expect(startPanelIsOpen()).toBe(true);
    view.unmount();
    expect(startPanelIsOpen()).toBe(false);
  });
});
