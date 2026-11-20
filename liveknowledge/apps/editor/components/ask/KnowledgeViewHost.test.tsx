// @vitest-environment jsdom

// The three views (docs/specs/030-knowledgebase/search-and-ask.md "The three views"): the switch's links, the view
// in the address, and the view over the editor.
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', () => ({
  default: (load: () => Promise<unknown>) => {
    const name = String(load).includes('AiKnowledgeView') ? 'ai' : 'ask';
    return () => <div data-testid={`view-${name}`} />;
  },
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { anyModalOpen } from '@liveworkspace/workbench/lib/modal-guard';
import { track } from '@/lib/telemetry';
import { showKnowledgeView } from '@/lib/knowledge-ask/knowledge-view';
import { KnowledgeCornerSwitch, KnowledgeSwitchRow, KnowledgeViewHost } from './KnowledgeViewHost';
import { chromeValue, renderInEditor } from './test-chrome';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/document/d1');
  vi.clearAllMocks();
});

const link = (name: string) => screen.getByRole('link', { name });

describe('the switch', () => {
  it('is three links, the showing view marked current', () => {
    window.history.replaceState(null, '', '/document/d1?view=ask#t=p1');
    renderInEditor(<KnowledgeCornerSwitch />);
    expect(screen.getByRole('navigation', { name: 'Knowledgebase Views' })).toBeTruthy();
    expect(link('Pages').getAttribute('href')).toBe('/document/d1#t=p1');
    expect(link('Ask').getAttribute('aria-current')).toBe('page');
    expect(link('Pages').getAttribute('aria-current')).toBeNull();
    expect(link('AI Knowledge').getAttribute('href')).toBe('/document/d1?view=ai#t=p1');
  });

  it('moves in place on a plain press and tells telemetry which view', () => {
    renderInEditor(<KnowledgeCornerSwitch />);
    fireEvent.click(link('Ask'));
    expect(window.location.search).toBe('?view=ask');
    expect(link('Ask').getAttribute('aria-current')).toBe('page');
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'AskView');
  });

  it('leaves a press for a new tab to the link', () => {
    renderInEditor(<KnowledgeCornerSwitch />);
    fireEvent.click(link('AI Knowledge'), { metaKey: true });
    expect(window.location.search).toBe('');
    expect(track).not.toHaveBeenCalled();
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
    renderInEditor(
      <>
        <KnowledgeCornerSwitch />
        <KnowledgeSwitchRow />
        <KnowledgeViewHost />
      </>,
      chromeValue('edit', over),
    );
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });
});

describe('the view over the editor', () => {
  const editor = () =>
    renderInEditor(
      <div>
        <KnowledgeSwitchRow />
        <div data-testid="header-layer">
          <div data-corner-actions="" />
        </div>
        <main data-region="canvas" data-testid="canvas" />
        <div data-testid="bars">
          <div data-region="tabs" />
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
    expect(screen.getByTestId('bars').hasAttribute('inert')).toBe(true);
    // The top row's card, with the switch in it, stays live.
    expect(screen.getByTestId('header-layer').hasAttribute('inert')).toBe(false);
    expect(anyModalOpen()).toBe(true);
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
