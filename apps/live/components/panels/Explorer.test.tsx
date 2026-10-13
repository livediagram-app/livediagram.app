// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DocumentListItem } from '@/lib/api-client';
import { Explorer } from './Explorer';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({ DocumentThumbnail: () => <span /> }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => false }));
// The views each fetch their own feed; here only which one the pane shows matters.
vi.mock('./explorer-panel/PanelViews', () => ({
  HomeSection: () => <p>home view</p>,
  InboxSection: () => <p>inbox view</p>,
  TimelineSection: () => <p>timeline view</p>,
  TrashSection: () => <p>trash view</p>,
  LibrarySection: () => <p>library view</p>,
}));

// docs/specs/013-workspace/explorer-structure.md "The editor's Explorer": a rail of sections beside a pane.
const doc = (id: string, name: string, over: Partial<DocumentListItem> = {}) =>
  ({
    id,
    name,
    ownerId: 'me',
    folderId: null,
    savedAt: 1,
    source: null,
    empty: true,
    ...over,
  }) as DocumentListItem;

function show() {
  render(
    <Explorer
      position={null}
      documents={[doc('d1', 'Roadmap'), doc('d2', 'Budget')]}
      ownerId="me"
      folders={[]}
      loading={false}
      currentDocumentId="d1"
      recentExcludedIds={[]}
      onToggleRecentExclusion={vi.fn()}
      favouriteIds={new Set()}
      onToggleFavourite={vi.fn()}
      onMoveTo={vi.fn()}
      onOpenDocument={vi.fn()}
      onRenameCurrent={vi.fn()}
    />,
  );
}

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Explorer', () => {
  it('opens on Home under its Current Document card, and lists My documents when picked', async () => {
    show();
    expect(screen.getByRole('region', { name: 'Current document' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rename Roadmap' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Home' })).toBeTruthy();
    expect(await screen.findByText('home view')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'My documents' }));
    expect(screen.getByRole('heading', { name: 'My documents' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Budget' })).toBeTruthy();
  });

  it('shows the picked section in the pane, never leaving the editor', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeTruthy();
    expect(await screen.findByText('timeline view')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open Page/ }).getAttribute('href')).toBe(
      '/explorer/timeline',
    );
  });

  it('carries the product links in its footer', () => {
    show();
    const links = screen.getByRole('navigation', { name: 'Go to' });
    expect(links.textContent).toContain('Help');
    expect(links.textContent).not.toContain('Editor');
  });
});
