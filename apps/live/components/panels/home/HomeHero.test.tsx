// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Home's hero (docs/specs/013-workspace/explorer-home.md "The hero"): the status pills open their views, the
// greeting is the page's heading, New document starts one, the lens field is drawn large with New document inside
// it, the sheets are decoration, and the menu button opens the drawer.

const { track, lensField } = vi.hoisted(() => ({ track: vi.fn(), lensField: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({
  DocumentThumbnail: (p: { documentId: string }) => <span data-testid={`thumb-${p.documentId}`} />,
}));
vi.mock('@/app/explorer/lens/LensField', () => ({
  LensField: (p: { size?: string; trailing?: React.ReactNode }) => {
    lensField(p);
    return (
      <div data-testid="lens" data-size={p.size}>
        {p.trailing}
      </div>
    );
  },
}));
vi.mock('@/components/primitives/HelpArticleLink', () => ({
  HelpArticleLink: (p: { article: string }) => <a href={`/help/${p.article}`}>Help</a>,
}));

import { ExplorerProvider } from '@/app/explorer/ExplorerContext';
import type { ExplorerStateValue } from '@/app/explorer/useExplorerState';
import { HomeHero } from './HomeHero';

const go = vi.fn();
const setMobileNavOpen = vi.fn();

function renderHero(over: Partial<ExplorerStateValue> = {}) {
  const value = {
    ownerId: 'me',
    documents: [
      { id: 'a', name: 'A', savedAt: 1 },
      { id: 'b', name: 'B', savedAt: 3 },
      { id: 'c', name: 'C', savedAt: 2 },
      { id: 'd', name: 'D', savedAt: 0 },
    ],
    loading: false,
    activity: { assignedToMe: [{}, {}], loading: false, error: false },
    go,
    setMobileNavOpen,
    lens: {},
    lensResult: { subjects: [] },
    ...over,
  } as unknown as ExplorerStateValue;
  return render(
    <ExplorerProvider value={value}>
      <HomeHero />
    </ExplorerProvider>,
  );
}

const assign = vi.fn();

beforeEach(() => {
  track.mockReset();
  go.mockReset();
  setMobileNavOpen.mockReset();
  lensField.mockReset();
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

  it('draws the lens field large with New document inside it', () => {
    renderHero();
    const lens = screen.getByTestId('lens');
    expect(lens.dataset.size).toBe('hero');
    fireEvent.click(within(lens).getByRole('button', { name: 'New document' }));
    expect(assign).toHaveBeenCalledWith('/new');
    expect(track).toHaveBeenLastCalledWith('Home', 'Selected', 'Hero.NewDocument');
  });

  it('fans the three newest documents as decoration', () => {
    const { container } = renderHero();
    const sheets = [...container.querySelectorAll('[data-hero-sheet]')];
    expect(
      sheets.map((s) => s.querySelector('[data-testid]')!.getAttribute('data-testid')),
    ).toEqual(['thumb-b', 'thumb-c', 'thumb-a']);
    expect(sheets[0]!.parentElement!.getAttribute('aria-hidden')).toBe('true');
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
