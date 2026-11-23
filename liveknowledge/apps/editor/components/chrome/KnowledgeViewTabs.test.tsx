// @vitest-environment jsdom

// The four views as tabs in the footer (docs/specs/030-knowledgebase/page-surface.md "The footer"): links with
// `aria-current`, the view in the address, a hover card each, and nothing a person's tab has (add, close, menu).
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const offline = vi.hoisted(() => ({ on: false }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({
  useIsOfflineDocument: () => offline.on,
}));
vi.mock('@/components/ask/SyncKnowledgebaseButton', () => ({
  SyncKnowledgebaseButton: () => <button type="button">Sync Knowledgebase</button>,
}));

import { track } from '@/lib/telemetry';
import { ROLES, chromeValue, renderInEditor } from '@/components/ask/test-chrome';
import { BottomBar } from './BottomBar';
import { KnowledgeViewTabs } from './KnowledgeViewTabs';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import { askGate } from '@/components/ask/AskGate';
import type { KnowledgeAiSettings } from '@liveknowledge/api-schema';

const keyed = (hasKey: boolean, builtIn = false) =>
  aiSettingsStore.set('d1', { hasKey, builtIn } as KnowledgeAiSettings);

afterEach(() => {
  offline.on = false;
  cleanup();
  aiSettingsStore.reset();
  askGate.close();
  window.history.replaceState(null, '', '/document/d1');
  vi.clearAllMocks();
});

const link = (name: string) => screen.getByRole('link', { name });

describe('the Ask gate', () => {
  it('with no key and built-in AI, opens Ask: built-in AI answers', async () => {
    keyed(false, true);
    renderInEditor(<KnowledgeViewTabs />);
    fireEvent.click(link('Ask'));
    await waitFor(() => expect(window.location.search).toBe('?view=ask'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('with no key and no built-in AI, stays on Pages and opens the gate over it; its Search closes it', async () => {
    keyed(false);
    renderInEditor(<KnowledgeViewTabs />);
    fireEvent.click(link('Ask'));
    const dialog = await screen.findByRole('dialog', { name: 'Built-In AI Is Not Set Up Here' });
    expect(window.location.search).toBe('');
    expect(track).not.toHaveBeenCalledWith('UI', 'Opened', 'AskView');
    expect(dialog.textContent).toContain('Open AI Settings');
    fireEvent.click(screen.getByRole('button', { name: 'Search the Pages' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('for someone not signed in, asks them to sign in, without reading the key', async () => {
    renderInEditor(<KnowledgeViewTabs />, chromeValue('view', { accountUserId: null }));
    fireEvent.click(link('Ask'));
    const dialog = await screen.findByRole('dialog', { name: 'Sign In to Ask' });
    expect(dialog.textContent).toContain('Sign In');
    expect(aiSettingsStore.get('d1').status).toBe('idle');
    expect(window.location.search).toBe('');
  });
});

// Connect (docs/specs/030-knowledgebase/mcp-connect.md "The tab"): connecting makes a token for an account.
describe('the Connect tab', () => {
  it('opens Connect for someone signed in, and tells telemetry', async () => {
    renderInEditor(<KnowledgeViewTabs />);
    fireEvent.click(link('Connect MCP'));
    await waitFor(() => expect(window.location.search).toBe('?view=connect'));
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'ConnectView');
  });

  it('for someone not signed in, stays on Pages and asks them to sign in', async () => {
    renderInEditor(<KnowledgeViewTabs />, chromeValue('edit', { accountUserId: null }));
    fireEvent.click(link('Connect MCP'));
    const dialog = await screen.findByRole('dialog', { name: 'Sign In to Connect an AI App' });
    expect(dialog.querySelector('a')?.textContent).toBe('Sign In');
    expect(window.location.search).toBe('');
    expect(track).not.toHaveBeenCalled();
  });

  it('says what it is for in its hover card', async () => {
    renderInEditor(<KnowledgeViewTabs />);
    fireEvent.pointerEnter(link('Connect MCP'), { pointerType: 'mouse' });
    const card = await screen.findByRole('tooltip');
    expect(card.textContent).toContain('Connect an AI App');
    expect(card.textContent).toContain('so it can read and write these pages');
  });
});

describe('the view tabs', () => {
  it('are four links in order, each with its icon, the showing view marked current', () => {
    window.history.replaceState(null, '', '/document/d1?view=ask#t=p1');
    renderInEditor(<KnowledgeViewTabs />);
    const nav = screen.getByRole('navigation', { name: 'Knowledgebase Views' });
    const links = [...nav.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual([
      'Pages',
      'Ask',
      'Insights',
      'Connect MCP',
    ]);
    for (const a of links) expect(a.querySelector('svg')).not.toBeNull();
    expect(link('Pages').getAttribute('href')).toBe('/document/d1#t=p1');
    expect(link('Insights').getAttribute('href')).toBe('/document/d1?view=insights#t=p1');
    expect(link('Connect MCP').getAttribute('href')).toBe('/document/d1?view=connect#t=p1');
    expect(link('Ask').getAttribute('aria-current')).toBe('page');
    expect(link('Pages').getAttribute('aria-current')).toBeNull();
    // The open tab alone wears the tab's card.
    expect(nav.querySelectorAll('[data-open]')).toHaveLength(1);
    expect(nav.querySelector('[data-open]')?.getAttribute('data-knowledge-view-tab')).toBe('ask');
  });

  it('in a knowledgebase kept Offline, keep Ask, Insights and Connect but quiet, going nowhere, saying why with Sync', async () => {
    offline.on = true;
    window.history.replaceState(null, '', '/document/d1#t=p1');
    renderInEditor(<KnowledgeViewTabs />);
    expect(link('Pages').getAttribute('href')).toBe('/document/d1#t=p1');
    for (const name of ['Ask', 'Insights', 'Connect MCP']) {
      const a = link(name);
      expect(a.getAttribute('href')).toBeNull();
      expect(a.getAttribute('aria-disabled')).toBe('true');
      expect(a.closest('[data-off]')).not.toBeNull();
    }
    fireEvent.click(link('Ask'));
    expect(track).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
    fireEvent.pointerEnter(link('Ask'), { pointerType: 'mouse' });
    const card = await screen.findByRole('tooltip');
    expect(card.textContent).toContain('Ask Needs Syncing');
    expect(card.textContent).toContain('kept in this browser');
    expect(screen.getByRole('button', { name: 'Sync Knowledgebase' })).toBeTruthy();
  });

  it('moves in place on a plain press, as a history entry, and tells telemetry which view', async () => {
    keyed(true);
    renderInEditor(<KnowledgeViewTabs />);
    const before = window.history.length;
    fireEvent.click(link('Ask'));
    await waitFor(() => expect(window.location.search).toBe('?view=ask'));
    expect(window.history.length).toBe(before + 1);
    expect(link('Ask').getAttribute('aria-current')).toBe('page');
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AskView');
  });

  it('leaves a press for a new tab to the link', () => {
    renderInEditor(<KnowledgeViewTabs />);
    fireEvent.click(link('Insights'), { metaKey: true });
    expect(window.location.search).toBe('');
    expect(track).not.toHaveBeenCalled();
  });

  it('are reached by the keyboard, and are not a person’s tabs: no add, close, drag or menu', () => {
    renderInEditor(<KnowledgeViewTabs />);
    const nav = screen.getByRole('navigation', { name: 'Knowledgebase Views' });
    for (const a of nav.querySelectorAll('a')) expect(a.tabIndex).toBe(0);
    expect(nav.querySelectorAll('button')).toHaveLength(0);
    expect(nav.querySelector('[draggable="true"]')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('show a hover card of a title and one line', async () => {
    renderInEditor(<KnowledgeViewTabs />);
    fireEvent.mouseEnter(link('Ask').closest('[data-knowledge-view-tab]')!.parentElement!);
    expect(
      await screen.findByText('Ask a question and get an answer from its pages.'),
    ).toBeTruthy();
  });

  it.each(ROLES)('are offered to a session of the %s role', (role) => {
    renderInEditor(<KnowledgeViewTabs />, chromeValue(role));
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });

  it.each([
    ['an embed', { embedMode: true }],
    ['zen mode', { zenMode: true }],
    ['the welcome flow', { anyWelcomeOpen: true }],
    ['a link confined to one page', { sessionTabScope: ['p1'] }],
    ['a Community visit', { sessionCommunity: {} }],
    ['a knowledgebase still loading', { hydrated: false }],
  ])('are not offered in %s', (_name, over) => {
    renderInEditor(<KnowledgeViewTabs />, chromeValue('edit', over));
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('the footer', () => {
  it('leads with the tabs, its own items after them', () => {
    renderInEditor(<BottomBar onOpenSettings={() => {}} onOpenSearch={() => {}} />);
    const nav = screen.getByRole('navigation', { name: 'Knowledgebase Views' });
    const settings = screen.getByRole('button', { name: 'Application settings' });
    expect(nav.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('on a phone keeps the tabs and the notification list in the row, the rest behind More', () => {
    renderInEditor(<BottomBar phone onOpenSettings={() => {}} onOpenSearch={() => {}} />);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    const more = screen.getByRole('button', { name: 'More' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    // Closed, the card's controls are out of the accessibility tree.
    expect(screen.queryByRole('button', { name: 'Application settings' })).toBeNull();
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('group', { name: 'More' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Application settings' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(more);
  });
});
