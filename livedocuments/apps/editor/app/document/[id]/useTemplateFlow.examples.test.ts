// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { hasUntouchedExamples, type Tab } from '@livedocuments/document';
import { useTemplateFlow } from './useTemplateFlow';

// docs/specs/006-document/template-examples.md: a picked template lands marked, and Clear Example Content and Keep It
// are each one commit (one undo step) on the active tab.

function flow(start: Tab) {
  let tabs: Tab[] = [start];
  const commitTabs = vi.fn((update: (ts: Tab[]) => Tab[]) => {
    tabs = update(tabs);
  });
  const { result } = renderHook(() =>
    useTemplateFlow({
      activeId: start.id,
      tabs,
      selfParticipant: { id: 'me', name: 'Me', color: '#000' } as never,
      documentName: 'Untitled',
      nameDocument: vi.fn(),
      getViewportCenter: () => ({ x: 0, y: 0 }),
      commitTabs,
      confirmName: vi.fn(),
      setSelectedId: vi.fn(),
      setEditingId: vi.fn(),
      setSelfParticipant: vi.fn(),
      setIdentityPromptOpen: vi.fn(),
      requestFit: vi.fn(),
      putToolDown: vi.fn(),
      markTabLoaded: vi.fn(),
    }),
  );
  return { result, commitTabs, tab: () => tabs[0]! };
}

const empty: Tab = { id: 't1', name: '', elements: [], theme: 'slate' };
const notes = (tab: Tab) =>
  tab.elements.filter((e) => e.type === 'sticky').map((e) => e.label ?? '');

describe('template example content in the editor', () => {
  it('lands marked, and Clear Example Content empties the notes in one commit', async () => {
    const f = flow(empty);
    await act(async () => {
      await f.result.current.chooseTemplate('live-card');
    });
    const landed = f.tab();
    expect(hasUntouchedExamples(landed.elements)).toBe(true);
    // The hook keeps its first render's tabs, so it is rendered again over the landed one.
    const g = flow(landed);
    act(() => g.result.current.clearExampleContent());
    expect(g.commitTabs).toHaveBeenCalledTimes(1);
    expect(notes(g.tab()).every((t) => t === '')).toBe(true);
    expect(g.tab().elements).toHaveLength(landed.elements.length);
  });

  it('Keep It keeps the notes in one commit', async () => {
    const f = flow(empty);
    await act(async () => {
      await f.result.current.chooseTemplate('live-card');
    });
    const landed = f.tab();
    const g = flow(landed);
    act(() => g.result.current.keepExampleContent());
    expect(g.commitTabs).toHaveBeenCalledTimes(1);
    expect(notes(g.tab())).toEqual(notes(landed));
    expect(hasUntouchedExamples(g.tab().elements)).toBe(false);
  });
});
