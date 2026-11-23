// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AccessLevel } from '@liveknowledge/api-schema';
import {
  MAX_KNOWLEDGEBASE_PAGES,
  newKnowledgebasePageContent,
  type Tab,
} from '@liveknowledge/document';
import { pageTitleOf } from '@liveknowledge/document';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { takeTitleFocus } from '@/lib/page-title-focus';
import { useTabActions } from './useTabActions';

// The tab actions in tree terms (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree" and "Share
// roles"): a page added under a parent, deleted with its subpages after one confirmation, duplicated beside itself,
// moved with the tree's checks, and named with its Title.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const page = (id: string, name: string, parent?: string): Tab => ({
  id,
  name,
  elements: [],
  ...newKnowledgebasePageContent(),
  ...(parent ? { parent } : {}),
});
// Handbook > (Release Process > Checklist, Onboarding), Notes
const TABS = [
  page('a', 'Handbook'),
  page('b', 'Release Process', 'a'),
  page('d', 'Checklist', 'b'),
  page('c', 'Onboarding', 'a'),
  page('e', 'Notes'),
];
const shape = (tabs: Tab[]) =>
  tabs.map((t) => `${t.id}${t.parent ? `<${t.parent}` : ''}`).join(' ');

function setup(over: Record<string, unknown> = {}) {
  let tabs: Tab[] = (over.tabs as Tab[] | undefined) ?? TABS;
  const apply = (map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  };
  const base: Record<string, unknown> = {
    activeId: 'a',
    // No saved knowledgebase: its delete has no Trash, as an Offline one's.
    documentId: null,
    canEditStructure: true,
    createTab: (name: string) => page('new', name),
    commitTabs: vi.fn(apply),
    tickTabs: vi.fn(apply),
    isTabLoaded: () => true,
    setActiveId: vi.fn(),
    confirm: vi.fn(() => Promise.resolve(true)),
    toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
    ...over,
  };
  const deps = () =>
    new Proxy<Record<string, unknown>>(
      { ...base, tabs },
      // Every other dependency the hook takes is a no-op here.
      { get: (target, key: string) => (key in target ? target[key] : vi.fn()) },
    );
  const hook = renderHook(() => useTabActions(deps() as never));
  return {
    actions: () => hook.result.current,
    rerender: () => hook.rerender(),
    tabs: () => tabs,
    deps: base as {
      commitTabs: ReturnType<typeof vi.fn>;
      tickTabs: ReturnType<typeof vi.fn>;
      setActiveId: ReturnType<typeof vi.fn>;
      confirm: ReturnType<typeof vi.fn>;
      toast: { error: ReturnType<typeof vi.fn> };
    },
  };
}

describe('adding a page', () => {
  it('asks for the caret in the Title of the page it opens (New Page, Add Subpage)', () => {
    const s = setup();
    s.actions().addTab();
    expect(takeTitleFocus('new')).toEqual({ from: document.body });
    s.actions().addTab('e');
    expect(takeTitleFocus('new')).toEqual({ from: document.body });
    // Refused, or a session that may not add: nothing is asked.
    setup({ canEditStructure: false }).actions().addTab();
    expect(takeTitleFocus('new')).toBeNull();
  });

  it('a page made by Create Page takes the caret in its Title when it is first opened', () => {
    const s = setup();
    expect(s.actions().addNamedSubpage('a', 'Rollback')).toBe('new');
    expect(s.deps.setActiveId).not.toHaveBeenCalled();
    expect(takeTitleFocus('new')).toEqual({ from: document.body });
  });

  it('adds an Untitled Page at the top level, and opens it', () => {
    const s = setup();
    s.actions().addTab();
    expect(shape(s.tabs())).toBe('a b<a d<b c<a e new');
    expect(s.tabs().at(-1)).toMatchObject({ name: 'Untitled Page' });
    expect(s.deps.setActiveId).toHaveBeenCalledWith('new');
  });

  it('adds a subpage as the last page under its parent', () => {
    const s = setup();
    s.actions().addTab('a');
    expect(shape(s.tabs())).toBe('a b<a d<b c<a new<a e');
  });

  it('carries the current page’s look', () => {
    const themed = [{ ...page('a', 'Handbook'), theme: 'slate' } as unknown as Tab];
    const s = setup({ tabs: themed });
    s.actions().addTab();
    expect(s.tabs().at(-1)).toMatchObject({ theme: 'slate' });
  });

  it('adds nothing past 500 pages, and says why', () => {
    const full = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES }, (_, i) => page(`t${i}`, `P${i}`));
    const s = setup({ tabs: full, activeId: 't0' });
    s.actions().addTab();
    expect(s.deps.commitTabs).not.toHaveBeenCalled();
    expect(s.deps.toast.error).toHaveBeenCalledWith('A knowledgebase holds 500 pages at most.');
  });

  it('adds nothing below the eighth level, and says why', () => {
    const deep = Array.from({ length: 8 }, (_, i) =>
      page(`p${i}`, `L${i}`, i ? `p${i - 1}` : undefined),
    );
    const s = setup({ tabs: deep, activeId: 'p0' });
    s.actions().addTab('p7');
    expect(s.deps.commitTabs).not.toHaveBeenCalled();
    expect(s.deps.toast.error).toHaveBeenCalledWith('Pages nest 8 levels deep at most.');
  });
});

describe('a subpage made from a page link', () => {
  it('is named as typed, sits under the page being written, and is not opened', () => {
    const s = setup();
    let made: string | null = null;
    act(() => {
      made = s.actions().addNamedSubpage('b', '  Rollbacks  ');
    });
    expect(made).toBe('new');
    expect(shape(s.tabs())).toBe('a b<a d<b new<b c<a e');
    const page = s.tabs().find((t) => t.id === 'new')!;
    expect(page.name).toBe('Rollbacks');
    expect(pageTitleOf(page)).toBe('Rollbacks');
    expect(s.deps.setActiveId).not.toHaveBeenCalled();
  });

  it('is not made past a limit, and says why', () => {
    const many = Array.from({ length: MAX_KNOWLEDGEBASE_PAGES }, (_, i) => page(`p${i}`, `P${i}`));
    const s = setup({ tabs: many, activeId: 'p0' });
    let made: string | null = 'x';
    act(() => {
      made = s.actions().addNamedSubpage('p0', 'Over');
    });
    expect(made).toBeNull();
    expect(s.tabs()).toHaveLength(MAX_KNOWLEDGEBASE_PAGES);
    expect(s.deps.toast.error).toHaveBeenCalled();
  });
});

describe('deleting a page', () => {
  it('asks once, naming the count, then removes the page and its subpages in one commit', async () => {
    const s = setup();
    await act(() => s.actions().deleteTab('b'));
    expect(s.deps.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete Release Process and 1 Subpage?',
        confirmLabel: 'Delete',
      }),
    );
    expect(s.deps.commitTabs).toHaveBeenCalledTimes(1);
    expect(shape(s.tabs())).toBe('a c<a e');
  });

  it('names several subpages, and none', async () => {
    const s = setup();
    await act(() => s.actions().deleteTab('a'));
    expect(s.deps.confirm.mock.calls[0]![0]).toMatchObject({
      title: 'Delete Handbook and 3 Subpages?',
      message: expect.stringContaining('Undo'),
    });
    const t = setup();
    await act(() => t.actions().deleteTab('e'));
    expect(t.deps.confirm.mock.calls[0]![0]).toMatchObject({ title: 'Delete Notes?' });
  });

  it("moves a saved knowledgebase's pages to the Trash, and says they can be restored", async () => {
    const s = setup({ documentId: 'kb' });
    await act(() => s.actions().deleteTab('b'));
    expect(s.deps.confirm).toHaveBeenCalledWith({
      title: 'Move Release Process and 1 Subpage to the Trash?',
      message:
        'You can restore them from the Trash for 30 days. Undo (Cmd/Ctrl-Z) brings them straight back.',
      confirmLabel: 'Move to Trash',
    });
    expect(shape(s.tabs())).toBe('a c<a e');
    const t = setup({ documentId: 'kb' });
    await act(() => t.actions().deleteTab('e'));
    expect(t.deps.confirm.mock.calls[0]![0]).toMatchObject({
      title: 'Move Notes to the Trash?',
      message: expect.stringContaining('restore it from the Trash'),
    });
  });

  it('removes nothing when the confirmation is declined', async () => {
    const s = setup({ confirm: vi.fn(() => Promise.resolve(false)) });
    await act(() => s.actions().deleteTab('b'));
    expect(s.deps.commitTabs).not.toHaveBeenCalled();
  });

  it('opens the page after the deleted ones when the current page goes with them', async () => {
    const s = setup({ activeId: 'd' });
    await act(() => s.actions().deleteTab('b'));
    expect(s.deps.setActiveId).toHaveBeenCalledWith('c');
  });

  it('never deletes the last page, and asks nothing', async () => {
    const s = setup({ tabs: [page('a', 'Handbook'), page('b', 'Sub', 'a')] });
    await act(() => s.actions().deleteTab('a'));
    expect(s.deps.confirm).not.toHaveBeenCalled();
    expect(s.tabs()).toHaveLength(2);
  });

  it('never deletes a locked page, or a page with a locked subpage', async () => {
    const locked = TABS.map((t) => (t.id === 'd' ? { ...t, locked: true } : t));
    const s = setup({ tabs: locked });
    await act(() => s.actions().deleteTab('b'));
    expect(s.deps.confirm).not.toHaveBeenCalled();
    expect(s.deps.toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/^Unlock .+ before deleting it\.$/),
    );
  });
});

describe('duplicating a page', () => {
  it('puts the copy beside the original, under the same parent, without its subpages', () => {
    const s = setup();
    s.actions().duplicateTab('b');
    const copy = s.tabs().find((t) => t.name === 'Release Process copy')!;
    expect(shape(s.tabs())).toBe(`a b<a d<b ${copy.id}<a c<a e`);
    // Its Title says its name, as every page's does.
    expect(pageTitleOf(copy)).toBe('Release Process copy');
  });
});

describe('moving a page', () => {
  it('moves it with its subpages where a drop asks', () => {
    const s = setup();
    s.actions().movePage('b', { parent: undefined, before: 'a' });
    expect(shape(s.tabs())).toBe('b d<b a c<a e');
  });

  it('refuses a move into its own subpages, and says why', () => {
    const s = setup();
    s.actions().movePage('a', { parent: 'd' });
    expect(s.deps.commitTabs).not.toHaveBeenCalled();
    expect(s.deps.toast.error).toHaveBeenCalledWith('A page cannot move inside its own subpages.');
  });

  it('steps, indents and outdents', () => {
    const s = setup();
    s.actions().stepPage('c', -1);
    expect(shape(s.tabs())).toBe('a c<a b<a d<b e');
    s.actions().outdentPage('c');
    expect(shape(s.tabs())).toBe('a b<a d<b c e');
    s.actions().indentPage('e');
    expect(shape(s.tabs())).toBe('a b<a d<b c e<c');
  });

  it('leaves the list as it is when the tree takes no such step', () => {
    const s = setup();
    const before = s.tabs();
    s.actions().stepPage('a', -1);
    s.actions().outdentPage('a');
    expect(s.tabs()).toBe(before);
  });
});

describe('a page’s name and its Title', () => {
  it('rewrites the Title when the page is renamed', () => {
    const s = setup();
    s.actions().renameTab('e', 'Meeting Notes');
    const renamed = s.tabs().find((t) => t.id === 'e')!;
    expect(renamed.name).toBe('Meeting Notes');
    expect(pageTitleOf(renamed)).toBe('Meeting Notes');
    expect(s.deps.commitTabs).toHaveBeenCalledTimes(1);
  });

  it('takes the Title as it is typed, without an undo step of its own', () => {
    const s = setup();
    s.actions().renameTabFromTitle('e', 'Typed Title');
    expect(s.tabs().find((t) => t.id === 'e')!.name).toBe('Typed Title');
    expect(s.deps.tickTabs).toHaveBeenCalledTimes(1);
    expect(s.deps.commitTabs).not.toHaveBeenCalled();
    // The same title again writes nothing; an emptied one leaves the page unnamed ("Untitled Page").
    s.rerender();
    s.actions().renameTabFromTitle('e', 'Typed Title');
    expect(s.deps.tickTabs).toHaveBeenCalledTimes(1);
    s.actions().renameTabFromTitle('e', '  ');
    expect(s.tabs().find((t) => t.id === 'e')!.name).toBe('');
    expect(s.deps.tickTabs).toHaveBeenCalledTimes(2);
  });

  it('opens a page whose writing is not loaded, and renames it once it has', () => {
    let loaded = false;
    const s = setup({ isTabLoaded: () => loaded });
    s.actions().renameTab('e', 'Later');
    expect(s.deps.commitTabs).not.toHaveBeenCalled();
    expect(s.deps.setActiveId).toHaveBeenCalledWith('e');
    loaded = true;
    s.rerender();
    expect(s.tabs().find((t) => t.id === 'e')!.name).toBe('Later');
    expect(pageTitleOf(s.tabs().find((t) => t.id === 'e')!)).toBe('Later');
    // Applied once.
    s.rerender();
    expect(s.deps.commitTabs).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles": each tree action, a role at a time. The
// editor hands the hook `canEditStructure` only for a session that may change the pages; a Participant and a Viewer
// are read-only for structure (`can.editPages` is false), so whichever control asks, nothing changes.
describe.each(['edit', 'participate', 'view'] as AccessLevel[])('share roles: %s', (level) => {
  const may = resolveEditorCapabilities(level).editPages;
  const run: [string, (a: ReturnType<typeof useTabActions>) => unknown][] = [
    ['add', (a) => a.addTab()],
    ['add a subpage', (a) => a.addTab('a')],
    ['add a named subpage from a page link', (a) => a.addNamedSubpage('a', 'Rollbacks')],
    ['rename', (a) => a.renameTab('e', 'Renamed')],
    ['rename by typing the title', (a) => a.renameTabFromTitle('e', 'Typed')],
    ['move', (a) => a.movePage('e', { parent: 'a' })],
    ['move up or down', (a) => a.stepPage('c', -1)],
    ['indent', (a) => a.indentPage('e')],
    ['outdent', (a) => a.outdentPage('c')],
    ['duplicate', (a) => a.duplicateTab('e')],
    ['delete', (a) => a.deleteTab('e')],
  ];
  it.each(run)(`${may ? 'may' : 'may not'} %s`, async (_label, action) => {
    const s = setup({ canEditStructure: may });
    const before = s.tabs();
    await act(async () => {
      await action(s.actions());
    });
    expect(s.tabs() !== before).toBe(may);
    if (!may) expect(s.deps.confirm).not.toHaveBeenCalled();
  });
});
