// @vitest-environment jsdom

// The views (docs/specs/030-knowledgebase/search-and-ask.md "The views"): the view over the editor. The
// way between them is the footer's tabs (components/chrome/KnowledgeViewTabs.test.tsx).
import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', () => ({
  default: (load: () => Promise<unknown>) => {
    const source = String(load);
    const name = source.includes('AiKnowledgeView')
      ? 'ai'
      : source.includes('ConnectView')
        ? 'connect'
        : source.includes('AskView')
          ? 'ask'
          : 'other';
    return () => <div data-testid={`view-${name}`} />;
  },
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/knowledge/go-to-block', () => ({ BLOCK_HIT_MS: 1600, goToBlock: vi.fn() }));

import { anyModalOpen } from '@liveworkspace/workbench/lib/modal-guard';
import { showKnowledgeView } from '@/lib/knowledge-ask/knowledge-view';
import { handArrival } from '@/lib/knowledge-home/arrival-handoff';
import { goToBlock } from '@/lib/knowledge/go-to-block';
import { KnowledgeViewAnchor, KnowledgeViewHost } from './KnowledgeViewHost';
import { chromeValue, renderInEditor } from './test-chrome';

afterEach(() => {
  cleanup();
  vi.mocked(goToBlock).mockClear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/document/d1');
  vi.clearAllMocks();
});

describe('the view over the editor', () => {
  const editor = () =>
    renderInEditor(
      <div>
        <KnowledgeViewAnchor />
        <main data-region="canvas" data-testid="canvas" />
        <div data-testid="bars">
          <div data-region="tabs" data-editor-tabbar="" />
        </div>
        <KnowledgeViewHost />
      </div>,
    );

  it('is nothing while Pages shows', () => {
    editor();
    expect(screen.queryByRole('region')).toBeNull();
    expect(anyModalOpen()).toBe(false);
  });

  it('shows Ask, makes the editor under it inert and quiets its shortcuts', () => {
    editor();
    act(() => showKnowledgeView('ask'));
    const region = screen.getByRole('region', { name: 'Ask' });
    expect(screen.getByTestId('view-ask')).toBeTruthy();
    expect(document.activeElement).toBe(region);
    expect(screen.getByTestId('canvas').hasAttribute('inert')).toBe(true);
    // The footer, whose tabs are the way to another view, stays live.
    expect(screen.getByTestId('bars').hasAttribute('inert')).toBe(false);
    expect(anyModalOpen()).toBe(true);
  });

  it('shows Connect in its own region', () => {
    editor();
    act(() => showKnowledgeView('connect'));
    expect(screen.getByRole('region', { name: 'Connect MCP' })).toBeTruthy();
    expect(screen.getByTestId('view-connect')).toBeTruthy();
  });

  it.each([
    ['an embed', { embedMode: true }],
    ['zen mode', { zenMode: true }],
    ['the welcome flow', { anyWelcomeOpen: true }],
    ['a link confined to one page', { sessionTabScope: ['p1'] }],
    ['a Community visit', { sessionCommunity: {} }],
    ['a knowledgebase still loading', { hydrated: false }],
  ])('is not offered in %s', (_name, over) => {
    window.history.replaceState(null, '', '/document/d1?view=ask');
    renderInEditor(<KnowledgeViewHost />, chromeValue('edit', over));
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('gives the editor back when Pages shows again, and follows the browser Back', () => {
    editor();
    act(() => showKnowledgeView('ai'));
    expect(screen.getByRole('region', { name: 'AI Knowledge' })).toBeTruthy();
    act(() => {
      window.history.replaceState(null, '', '/document/d1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByTestId('canvas').hasAttribute('inert')).toBe(false);
    expect(anyModalOpen()).toBe(false);
  });
});

// knowledgebase-home.md "Start a Knowledgebase From": Import asked for on Home opens here, for someone who may import.
describe('Import handed over by the Knowledgebase Home', () => {
  it.each([
    ['edit', true],
    ['participate', true],
    ['view', false],
  ] as const)('as %s', (role, opens) => {
    handArrival({ kind: 'import', documentId: 'd1' });
    const setImportOpen = vi.fn();
    renderInEditor(<KnowledgeViewHost />, chromeValue(role, { setImportOpen }));
    expect(setImportOpen.mock.calls).toEqual(opens ? [[true]] : []);
  });

  // A search result's passage, pressed on Home: the page opens at the passage's first block, by the search
  // dialog's own way in (goToBlock), for every role, once.
  it.each(['edit', 'participate', 'view'] as const)(
    'opens the page at the passage Home handed over, as %s',
    (role) => {
      handArrival({ kind: 'passage', documentId: 'd1', tab: 'p2', block: 'b7' });
      renderInEditor(<KnowledgeViewHost />, chromeValue(role)).unmount();
      expect(vi.mocked(goToBlock).mock.calls.map((call) => call.slice(1))).toEqual([['p2', 'b7']]);
      renderInEditor(<KnowledgeViewHost />, chromeValue(role));
      expect(goToBlock).toHaveBeenCalledTimes(1);
    },
  );

  it('waits for the knowledgebase, leaves another knowledgebase’s passage alone, and opens no page that is gone', () => {
    handArrival({ kind: 'passage', documentId: 'd1', tab: 'p2', block: 'b7' });
    renderInEditor(<KnowledgeViewHost />, chromeValue('edit', { hydrated: false })).unmount();
    expect(goToBlock).not.toHaveBeenCalled();
    renderInEditor(<KnowledgeViewHost />, chromeValue('edit', { documentId: 'other' })).unmount();
    expect(goToBlock).not.toHaveBeenCalled();
    handArrival({ kind: 'passage', documentId: 'd1', tab: 'gone', block: 'b7' });
    renderInEditor(<KnowledgeViewHost />, chromeValue('edit'));
    expect(goToBlock).not.toHaveBeenCalled();
  });

  it('opens once', () => {
    handArrival({ kind: 'import', documentId: null });
    const setImportOpen = vi.fn();
    renderInEditor(<KnowledgeViewHost />, chromeValue('edit', { setImportOpen })).unmount();
    renderInEditor(<KnowledgeViewHost />, chromeValue('edit', { setImportOpen }));
    expect(setImportOpen).toHaveBeenCalledTimes(1);
  });
});
