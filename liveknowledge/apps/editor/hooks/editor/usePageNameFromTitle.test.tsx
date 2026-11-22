// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newKnowledgebasePageContent, type Tab } from '@liveknowledge/document';
import { withPageTitle } from '@liveknowledge/document';
import { PAGE_NAME_SETTLE_MS, usePageNameFromTitle } from './usePageNameFromTitle';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree": typing the Title renames the page, one
// write when the typing stops.

const page = (id: string, title = ''): Tab =>
  withPageTitle(
    { id, name: 'Untitled Page', elements: [], ...newKnowledgebasePageContent() },
    title,
  );

function setup(canEdit = true) {
  const rename = vi.fn();
  const localEditSeq = { current: 0 };
  const hook = renderHook(
    ({ tab }: { tab: Tab }) =>
      usePageNameFromTitle({ activeTab: tab, canEdit, localEditSeq, rename }),
    { initialProps: { tab: page('a') } },
  );
  // A keystroke in the Title: a local edit, then the page with its new title.
  const type = (id: string, title: string) => {
    localEditSeq.current += 1;
    hook.rerender({ tab: page(id, title) });
  };
  return { rename, hook, type };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('usePageNameFromTitle', () => {
  it('renames the page once, when the typing stops', () => {
    const s = setup();
    for (const title of ['R', 'Re', 'Rel', 'Release']) {
      s.type('a', title);
      vi.advanceTimersByTime(PAGE_NAME_SETTLE_MS - 1);
    }
    expect(s.rename).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(s.rename).toHaveBeenCalledTimes(1);
    expect(s.rename).toHaveBeenCalledWith('a', 'Release');
  });

  it('writes nothing for a render that changes no title', () => {
    const s = setup();
    s.type('a', 'Release');
    vi.advanceTimersByTime(PAGE_NAME_SETTLE_MS);
    s.hook.rerender({ tab: page('a', 'Release') });
    vi.advanceTimersByTime(PAGE_NAME_SETTLE_MS * 2);
    expect(s.rename).toHaveBeenCalledTimes(1);
  });

  it('follows no title it did not type: a page loading, a peer typing', () => {
    const s = setup();
    // The title arrives with no local edit.
    s.hook.rerender({ tab: page('a', 'From Elsewhere') });
    vi.advanceTimersByTime(PAGE_NAME_SETTLE_MS * 2);
    expect(s.rename).not.toHaveBeenCalled();
  });

  it('never renames by opening another page', () => {
    const s = setup();
    s.hook.rerender({ tab: page('b', 'Another Page') });
    vi.advanceTimersByTime(PAGE_NAME_SETTLE_MS * 2);
    expect(s.rename).not.toHaveBeenCalled();
  });

  it('names the page at once when the person moves on before the typing has rested', () => {
    const s = setup();
    s.type('a', 'Release');
    s.hook.rerender({ tab: page('b', 'Another Page') });
    expect(s.rename).toHaveBeenCalledWith('a', 'Release');
    vi.advanceTimersByTime(PAGE_NAME_SETTLE_MS * 2);
    expect(s.rename).toHaveBeenCalledTimes(1);
  });

  it('renames nothing for a session that may not change the pages', () => {
    const s = setup(false);
    s.type('a', 'Release');
    vi.advanceTimersByTime(PAGE_NAME_SETTLE_MS * 2);
    expect(s.rename).not.toHaveBeenCalled();
  });

  it('drops a rename still waiting when the editor closes', () => {
    const s = setup();
    s.type('a', 'Release');
    s.hook.unmount();
    vi.advanceTimersByTime(PAGE_NAME_SETTLE_MS * 2);
    expect(s.rename).not.toHaveBeenCalled();
  });
});
