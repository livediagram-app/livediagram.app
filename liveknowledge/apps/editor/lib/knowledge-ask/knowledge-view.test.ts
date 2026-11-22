// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  currentKnowledgeView,
  knowledgeViewHref,
  knowledgeViewOf,
  showKnowledgeView,
  subscribeKnowledgeView,
} from './knowledge-view';

afterEach(() => window.history.replaceState(null, '', '/document/d1'));

describe('the view an address names', () => {
  it('is Pages unless it names Ask, AI Knowledge or Connect', () => {
    expect(knowledgeViewOf('')).toBe('pages');
    expect(knowledgeViewOf('?view=ask')).toBe('ask');
    expect(knowledgeViewOf('?s=abc&view=ai')).toBe('ai');
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
    showKnowledgeView('ai', { replace: true });
    expect(window.history.length).toBe(before);
    expect(currentKnowledgeView()).toBe('ai');
  });
});
