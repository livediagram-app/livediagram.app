// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Home's hero (docs/specs/013-workspace/explorer-home.md "The hero"): the status pills open their views, the
// greeting is the page's heading, New Document starts one, the lens field is drawn large with New Document inside
// it, the sheets are decoration, and the menu button opens the drawer.

const { track, lensField, commitUserPreferences } = vi.hoisted(() => ({
  track: vi.fn(),
  lensField: vi.fn(),
  commitUserPreferences: vi.fn(),
}));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/lib/user-preferences', async (orig) => ({
  ...(await orig<typeof import('@/lib/user-preferences')>()),
  commitUserPreferences,
}));
vi.mock('@/components/panels/DocumentThumbnail', () => ({
  DocumentThumbnail: (p: { documentId: string; offline?: boolean }) => (
    <span data-testid={`thumb-${p.documentId}`} data-offline={p.offline ? '' : undefined} />
  ),
}));
vi.mock('@/app/explorer/lens/LensField', () => ({
  HERO_FIELD_LOOK: { wrap: '', box: '', glyph: 18, input: '' },
  LensField: (p: { size?: string; trailing?: React.ReactNode }) => {
    lensField(p);
    return (
      <div data-testid="lens" data-size={p.size}>
        {p.trailing}
      </div>
    );
  },
  LensFieldStill: (p: { trailing?: React.ReactNode }) => (
    <div data-testid="lens-still">{p.trailing}</div>
  ),
}));
vi.mock('@/components/primitives/HelpArticleLink', () => ({
  HelpArticleLink: (p: { article: string }) => <a href={`/help/${p.article}`}>Help</a>,
}));

import { ExplorerProvider } from '@/app/explorer/ExplorerContext';
import type { ExplorerStateValue } from '@/app/explorer/useExplorerState';
import { HomeHero } from './HomeHero';

const go = vi.fn();
const setMobileNavOpen = vi.fn();

function renderHero(over: Partial<ExplorerStateValue> = {}, active = true) {
  const value = {
    ownerId: 'me',
    documents: [
      { id: 'a', name: 'A', savedAt: 1 },
      { id: 'b', name: 'B', savedAt: 3 },
      { id: 'c', name: 'C', savedAt: 2 },
      { id: 'd', name: 'D', savedAt: 0 },
    ],
    loading: false,
    shared: [],
    teamDocuments: [],
    offlineDocuments: [],
    clerkUserId: null,
    failedReads: { documents: false, shared: false },
    activity: { assignedToMe: [{}, {}], loading: false, error: false },
    go,
    setMobileNavOpen,
    lens: {},
    lensResult: { subjects: [] },
    prefs: { showMinimap: false },
    ...over,
  } as unknown as ExplorerStateValue;
  return render(
    <ExplorerProvider value={value}>
      <HomeHero active={active} />
    </ExplorerProvider>,
  );
}

const assign = vi.fn();

beforeEach(() => {
  track.mockReset();
  go.mockReset();
  setMobileNavOpen.mockReset();
  lensField.mockReset();
  commitUserPreferences.mockReset();
  assign.mockReset();
  vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('HomeHero', () => {
  it('greets the reader in a level-one heading that names the band', () => {
    renderHero();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(
      /^Good (morning|afternoon|evening)\. What are we picking up\?$/,
    );
    expect(screen.getByRole('region', { name: heading.textContent })).toBeTruthy();
  });

  it('counts the documents and the Inbox in pills that open their views', () => {
    renderHero();
    const docs = screen.getByRole('link', { name: '4 documents' });
    expect(docs.getAttribute('href')).toBe('/explorer/all');
    fireEvent.click(docs);
    expect(go).toHaveBeenLastCalledWith({ kind: 'all' });
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'Hero.Documents');
    fireEvent.click(screen.getByRole('link', { name: '2 open in your Inbox' }));
    expect(go).toHaveBeenLastCalledWith({ kind: 'inbox' });
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'Hero.Inbox');
  });

  it('draws no pill while its count is unknown', () => {
    renderHero({
      loading: true,
      activity: { assignedToMe: [], loading: true, error: false },
    } as unknown as Partial<ExplorerStateValue>);
    expect(screen.queryByRole('link', { name: /documents?$/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Inbox/ })).toBeNull();
  });

  it('draws no documents pill when the list failed to load, never "0 documents"', () => {
    renderHero({
      documents: [],
      failedReads: { documents: true, shared: false },
    });
    expect(screen.queryByRole('link', { name: /documents?$/ })).toBeNull();
  });

  it('draws the lens field large with New Document inside it', () => {
    renderHero();
    const lens = screen.getByTestId('lens');
    expect(lens.dataset.size).toBe('hero');
    fireEvent.click(within(lens).getByRole('button', { name: 'New Document' }));
    expect(assign).toHaveBeenCalledWith('/new');
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'Hero.NewDocument');
  });

  it('draws its field still while it folds away, so the page holds one live field', () => {
    renderHero({}, false);
    expect(screen.queryByTestId('lens')).toBeNull();
    expect(screen.getByTestId('lens-still')).toBeTruthy();
    expect(lensField).not.toHaveBeenCalled();
  });

  it('fans the three newest documents as decoration', () => {
    const { container } = renderHero();
    const sheets = [...container.querySelectorAll('[data-hero-sheet]')];
    expect(
      sheets.map((s) => s.querySelector('[data-testid]')!.getAttribute('data-testid')),
    ).toEqual(['thumb-b', 'thumb-c', 'thumb-a']);
    expect(sheets[0]!.parentElement!.getAttribute('aria-hidden')).toBe('true');
  });

  // docs/specs/006-document/document-snapshots.md: a document in This Browser has no server snapshot to ask for.
  it('draws a document in This Browser without asking the server for its snapshot', () => {
    const { container } = renderHero({
      documents: [
        { id: 'a', name: 'A', savedAt: 1, ownerId: 'me' },
        { id: 'b', name: 'B', savedAt: 3, ownerId: 'offline' },
      ] as never,
    });
    expect(container.querySelector('[data-testid="thumb-b"]')!.hasAttribute('data-offline')).toBe(
      true,
    );
    expect(container.querySelector('[data-testid="thumb-a"]')!.hasAttribute('data-offline')).toBe(
      false,
    );
  });

  it('welcomes a person with nothing yet: plain pills, the template search, no document sheets', () => {
    const { container } = renderHero({ documents: [] });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Welcome to livediagram. What are you making first?',
    );
    expect(screen.queryByRole('link', { name: /documents?$/ })).toBeNull();
    expect(screen.getByText('Free and open source')).toBeTruthy();
    expect(screen.getByText('No sign-up to start')).toBeTruthy();
    expect(screen.getByRole('searchbox', { name: 'Search templates' })).toBeTruthy();
    expect(screen.queryByTestId('lens')).toBeNull();
    expect(container.querySelectorAll('[data-testid^="thumb-"]')).toHaveLength(0);
  });

  it('tells a signed-in newcomer their work is saved to their account', () => {
    renderHero({ documents: [], clerkUserId: 'user_1' });
    expect(screen.getByText('Saved to your account')).toBeTruthy();
  });

  it('opens the drawer from its menu button and links Help', () => {
    renderHero();
    fireEvent.click(screen.getByRole('button', { name: 'Browse sections' }));
    expect(setMobileNavOpen).toHaveBeenCalledWith(true);
    expect(screen.getAllByRole('link', { name: 'Help' })[0]!.getAttribute('href')).toBe(
      '/help/timeline',
    );
  });
});

// docs/specs/013-workspace/explorer-home.md "Hiding the banner": a close beside every Help the hero draws, which
// hides the banner as the synced preference, told to telemetry before it is written.
describe('HomeHero close', () => {
  it('stands beside each Help and hides the banner for good', () => {
    renderHero();
    const closes = screen.getAllByRole('button', { name: 'Hide Home Banner' });
    expect(closes).toHaveLength(screen.getAllByRole('link', { name: 'Help' }).length);
    fireEvent.click(closes[0]!);
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'HomeBannerOff');
    expect(commitUserPreferences).toHaveBeenCalledWith(
      { showMinimap: false },
      { showMinimap: false, homeBanner: false },
      'me',
    );
    expect(track.mock.invocationCallOrder[0]!).toBeLessThan(
      commitUserPreferences.mock.invocationCallOrder[0]!,
    );
  });
});
