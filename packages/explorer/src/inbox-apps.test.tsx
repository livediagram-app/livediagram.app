// The per-app Inbox switch (inbox-apps.ts): livehuddle's Explorer, the editor's panel and its pages alike, has no
// Inbox row, section, badge or hero pill, never reads GET /inbox, and opens Home at the Inbox's address. The other
// four products keep every one of them.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, InboxAction } from '@liveworkspace/index-client';
import { createFakeIndex } from './test/fakeClient';
import { appHasInbox } from './inbox-apps';
import { Explorer } from './explorer/Explorer';
import { ExplorerPanel } from './panel/ExplorerPanel';
import { panelSectionGroups, panelSectionStorageKey, resolveSection } from './panel/sections';

const KEEPERS: App[] = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'];

// One open action assigned to the viewer: the Inbox counts it.
const action = (app: App): InboxAction => ({
  app,
  itemId: 'doc-1',
  itemTitle: 'Launch',
  itemTeamId: null,
  tabId: 'tab-1',
  tabName: 'Main',
  elementId: 'el-1',
  actionId: 'a1',
  elementLabel: 'Kick-off',
  name: 'Book the room',
  description: '',
  status: 'open',
  assigneeId: 'user_me',
  assigneeName: 'Me Person',
  assignerId: 'user_you',
  assignerName: 'Sam Lee',
  teamId: null,
  card: null,
  createdAt: 1,
  updatedAt: 2,
});

function indexWithInbox(app: App) {
  const index = createFakeIndex({ items: [] });
  index.inbox.actions.push(action(app));
  return index;
}

function renderPage(app: App, view: 'home' | 'inbox' = 'home') {
  const index = indexWithInbox(app);
  render(
    <Explorer
      app={app}
      client={index.client}
      view={{ kind: view }}
      onNavigate={vi.fn()}
      itemHref={(item) => `/open/${item.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
    />,
  );
  return index;
}

function renderPanel(app: App) {
  const index = indexWithInbox(app);
  render(
    <ExplorerPanel
      app={app}
      client={index.client}
      itemHref={(item) => `/open/${item.id}`}
      onCreate={vi.fn()}
      onOpenExplorer={vi.fn()}
      viewerId="user_me"
    />,
  );
  return index;
}

const sections = () => screen.getByRole('navigation', { name: 'Sections' });
const rail = () => screen.getByRole('navigation', { name: 'Explorer sections' });

describe('appHasInbox', () => {
  it('is false for livehuddle alone', () => {
    expect(appHasInbox('livehuddle')).toBe(false);
    for (const app of KEEPERS) expect(appHasInbox(app)).toBe(true);
  });
});

describe('panelSectionGroups without the Inbox', () => {
  it('leaves the Inbox out of Overview, and a remembered Inbox resolves to Home', () => {
    const groups = panelSectionGroups([], { inbox: false });
    expect(groups[0]!.sections).toEqual([{ kind: 'home' }, { kind: 'shared' }]);
    expect(resolveSection({ kind: 'inbox' }, groups)).toEqual({ kind: 'home' });
    expect(panelSectionGroups([])[0]!.sections).toContainEqual({ kind: 'inbox' });
  });
});

describe('the Explorer page', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('shows livehuddle no Inbox row and never reads the Inbox', async () => {
    const index = renderPage('livehuddle');
    await waitFor(() => expect(index.count('listItems')).toBeGreaterThan(0));
    expect(within(sections()).queryByRole('button', { name: /Inbox/ })).toBeNull();
    expect(document.querySelector('[data-hero-pill="inbox"]')).toBeNull();
    expect(index.count('inbox')).toBe(0);
  });

  it("opens livehuddle's Home at the Inbox's address", async () => {
    const index = renderPage('livehuddle', 'inbox');
    await waitFor(() => expect(index.count('listItems')).toBeGreaterThan(0));
    expect(document.querySelector('[data-explorer-view="inbox"]')).toBeNull();
    expect(index.count('inbox')).toBe(0);
  });

  it.each(KEEPERS)('keeps the Inbox row, its badge and its pane for %s', async (app) => {
    const index = renderPage(app);
    const row = await within(sections()).findByRole('button', { name: /Inbox/ });
    await waitFor(() => expect(row.textContent).toContain('1'));
    expect(index.count('inbox')).toBeGreaterThan(0);
    cleanup();
    renderPage(app, 'inbox');
    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeTruthy();
  });
});

describe("the editor's Explorer panel", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('shows livehuddle no Inbox in the rail, even when the browser remembers it', async () => {
    localStorage.setItem(panelSectionStorageKey('livehuddle'), 'inbox');
    const index = renderPanel('livehuddle');
    expect(within(rail()).queryByRole('button', { name: /Inbox/ })).toBeNull();
    expect(within(rail()).getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBe(
      'true',
    );
    await waitFor(() => expect(index.count('listItems')).toBeGreaterThan(0));
    expect(index.count('inbox')).toBe(0);
  });

  it.each(KEEPERS)('keeps the Inbox in the rail with its count for %s', async (app) => {
    const index = renderPanel(app);
    const entry = within(rail()).getByRole('button', { name: /Inbox/ });
    await waitFor(() => expect(entry.textContent).toContain('1'));
    expect(index.count('inbox')).toBeGreaterThan(0);
  });
});
