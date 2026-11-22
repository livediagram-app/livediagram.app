// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { articlesOf, newKnowledgebasePageContent, type Tab } from '@liveknowledge/document';
import { clearTitleFocus, wantTitleFocus } from '@/lib/page-title-focus';
import { usePageTitleFocus } from './usePageTitleFocus';

// A page made here opens with the caret in its Title (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A
// knowledgebase", "Add").
const page = (id: string): Tab => ({
  id,
  name: id,
  elements: [],
  ...newKnowledgebasePageContent(),
});
const flowOf = (tab: Tab) => Object.keys(articlesOf(tab))[0]!;

beforeEach(clearTitleFocus);

function setup(first: Tab, over: { editable?: boolean } = {}) {
  const focusTitle = vi.fn();
  const hook = renderHook(
    (p: { tab: Tab; editable: boolean; up: boolean }) =>
      usePageTitleFocus({
        activeTab: p.tab,
        editable: p.editable,
        focusTitle: p.up ? focusTitle : null,
      }),
    { initialProps: { tab: first, editable: over.editable ?? true, up: true } },
  );
  return { focusTitle, hook };
}

describe('usePageTitleFocus', () => {
  it('asks for the caret in the Title of a page made here, as it opens', () => {
    const a = page('a');
    const made = page('made');
    const s = setup(a);
    expect(s.focusTitle).not.toHaveBeenCalled();
    wantTitleFocus('made');
    s.hook.rerender({ tab: made, editable: true, up: true });
    expect(s.focusTitle).toHaveBeenCalledExactlyOnceWith(flowOf(made));
  });

  it('asks once: the page opened again later takes no caret', () => {
    const a = page('a');
    const made = page('made');
    wantTitleFocus('made');
    const s = setup(made);
    s.hook.rerender({ tab: a, editable: true, up: true });
    s.hook.rerender({ tab: made, editable: true, up: true });
    expect(s.focusTitle).toHaveBeenCalledTimes(1);
  });

  it('leaves a page nobody made here alone', () => {
    const s = setup(page('a'));
    s.hook.rerender({ tab: page('b'), editable: true, up: true });
    expect(s.focusTitle).not.toHaveBeenCalled();
  });

  it("a new knowledgebase's first page, asked for before the editor mounts, takes it at mount", () => {
    const first = page('first');
    wantTitleFocus('first');
    const s = setup(first);
    expect(s.focusTitle).toHaveBeenCalledExactlyOnceWith(flowOf(first));
  });

  it('waits for the writing: a page still loading keeps its ask until it has landed', () => {
    const loading: Tab = { id: 'made', name: 'made', elements: [] };
    wantTitleFocus('made');
    const s = setup(loading);
    expect(s.focusTitle).not.toHaveBeenCalled();
    const landed = { ...page('made') };
    s.hook.rerender({ tab: landed, editable: true, up: true });
    expect(s.focusTitle).toHaveBeenCalledExactlyOnceWith(flowOf(landed));
  });

  it('waits for the articles and for a session that may write', () => {
    const made = page('made');
    wantTitleFocus('made');
    const s = setup(made, { editable: false });
    s.hook.rerender({ tab: made, editable: true, up: false });
    expect(s.focusTitle).not.toHaveBeenCalled();
    s.hook.rerender({ tab: made, editable: true, up: true });
    expect(s.focusTitle).toHaveBeenCalledTimes(1);
  });

  it('a locked page takes no caret', () => {
    const made = { ...page('made'), locked: true };
    wantTitleFocus('made');
    const s = setup(made);
    expect(s.focusTitle).not.toHaveBeenCalled();
  });
});
