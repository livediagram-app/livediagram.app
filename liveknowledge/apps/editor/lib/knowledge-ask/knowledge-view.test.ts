// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  currentKnowledgeView,
  knowledgeViewHref,
  knowledgeViewOf,
  knowledgeViewsShown,
  showKnowledgeView,
  subscribeKnowledgeView,
} from './knowledge-view';

afterEach(() => window.history.replaceState(null, '', '/document/d1'));

// mcp-connect.md "Closing the tab".
describe('the views the footer shows', () => {
  const names = (showConnect: boolean, current: Parameters<typeof knowledgeViewsShown>[1]) =>
    knowledgeViewsShown(showConnect, current).map(({ view }) => view);

  it('are all four while Connect MCP is shown', () => {
    expect(names(true, 'pages')).toEqual(['pages', 'ask', 'insights', 'connect']);
  });

  it('leave out Connect once it is hidden', () => {
    expect(names(false, 'pages')).toEqual(['pages', 'ask', 'insights']);
    expect(names(false, 'ask')).toEqual(['pages', 'ask', 'insights']);
  });

  it('keep Connect while a link has it open, hidden or not', () => {
    expect(names(false, 'connect')).toEqual(['pages', 'ask', 'insights', 'connect']);
  });
});

describe('the view an address names', () => {
  it('is Pages unless it names Ask, Insights or Connect', () => {
    expect(knowledgeViewOf('')).toBe('pages');
    expect(knowledgeViewOf('?view=ask')).toBe('ask');
    expect(knowledgeViewOf('?s=abc&view=insights')).toBe('insights');
    // Its name before the rename still opens it.
    expect(knowledgeViewOf('?view=ai')).toBe('insights');
    expect(knowledgeViewOf('?view=connect')).toBe('connect');
    expect(knowledgeViewOf('?view=slides')).toBe('pages');
    expect(knowledgeViewOf('?view=toString')).toBe('pages');
  });

  it('keeps the path, the share code and the open page', () => {
    expect(knowledgeViewHref('https://x.test/document/shared?s=abc#t=p1', 'ask')).toBe(
      '/document/shared?s=abc&view=ask#t=p1',
    );
    expect(knowledgeViewHref('/document/d1?view=ask#t=p1', 'pages')).toBe('/document/d1#t=p1');
  });
});

describe('showing a view', () => {
  it('adds a history entry, so Back returns to the view before', () => {
    window.history.replaceState(null, '', '/document/d1#t=p1');
    const heard = vi.fn();
    const stop = subscribeKnowledgeView(heard);
    const before = window.history.length;
    showKnowledgeView('ask');
    expect(window.location.search).toBe('?view=ask');
    expect(window.location.hash).toBe('#t=p1');
    expect(window.history.length).toBe(before + 1);
    expect(currentKnowledgeView()).toBe('ask');
    expect(heard).toHaveBeenCalledTimes(1);
    // The view already showing adds nothing.
    showKnowledgeView('ask');
    expect(window.history.length).toBe(before + 1);
    // The browser's Back is heard.
    window.history.replaceState(null, '', '/document/d1#t=p1');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(heard).toHaveBeenCalledTimes(2);
    expect(currentKnowledgeView()).toBe('pages');
    stop();
  });

  it('replaces the entry when asked', () => {
    const before = window.history.length;
    showKnowledgeView('insights', { replace: true });
    expect(window.history.length).toBe(before);
    expect(currentKnowledgeView()).toBe('insights');
  });
});
