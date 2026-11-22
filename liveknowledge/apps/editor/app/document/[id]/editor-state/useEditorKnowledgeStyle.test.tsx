// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_KNOWLEDGE_STYLE, type KnowledgeStyle, type Tab } from '@liveknowledge/document';
import {
  historyCommit,
  historyMarkCheckpoint,
  historyRedo,
  historyUndo,
  type History,
} from '@/hooks/canvas/useDocumentHistory';
import { knowledgeStyleStore } from '@/lib/knowledge-style/knowledge-style-store';
import { changeKnowledgeStyle } from '@/lib/knowledge-style/style-change';
import { useEditorKnowledgeStyle } from './useEditorKnowledgeStyle';

// docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style": "Changing it changes every page at once, for
// everyone, as one undoable edit; pages are not rewritten or re-saved, and pages not on screen are not laid out."
const save = vi.fn<(...a: unknown[]) => Promise<void>>(async () => {});
vi.mock('@/lib/api/knowledge-style', () => ({
  apiSaveKnowledgeStyle: (...a: unknown[]) => save(...a),
}));
// Every way a page is written or laid out away from the screen: counted, and none may be called.
const saveTab = vi.fn<(...a: unknown[]) => void>();
const layOut = vi.fn<(...a: unknown[]) => void>();
vi.mock('@/lib/api/tabs', () => ({ apiSaveTab: (...a: unknown[]) => saveTab(...a) }));
vi.mock('@/lib/article/article-estimate-cache', () => ({
  estimatedPageOps: (...a: unknown[]) => layOut(...a),
}));
const toastError = vi.fn();
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => ({ error: toastError }) }));

const STEEL: KnowledgeStyle = { ...DEFAULT_KNOWLEDGE_STYLE, theme: 'steel' };
const OCEAN: KnowledgeStyle = { ...DEFAULT_KNOWLEDGE_STYLE, theme: 'ocean' };
const page = (id: string): Tab =>
  ({
    id,
    name: id,
    elements: [],
    articles: { f: { blocks: [{ id: 'b', type: 'paragraph', runs: [{ text: id }] }] } },
  }) as unknown as Tab;

afterEach(() => {
  cleanup();
  knowledgeStyleStore.clear();
  vi.clearAllMocks();
});

/** The slice over a real history of a knowledgebase's pages, as the editor composes them. */
function setUp(mayStyle = true, pages = 3) {
  const tabs = Array.from({ length: pages }, (_, i) => page(`p${i}`));
  let history: History = { past: [], present: tabs, future: [] };
  // Every commit of the tabs, counted: what autosave would then save.
  const commits = vi.fn();
  const hook = renderHook(
    ({ h }: { h: History }) =>
      useEditorKnowledgeStyle({
        documentId: 'kb',
        ownerId: 'user_o',
        shareCode: null,
        mayStyle,
        depth: h.depth ?? 0,
        branch: h.branch ?? 0,
        markCheckpoint: () => {
          history = historyMarkCheckpoint(history);
        },
      }),
    { initialProps: { h: history } },
  );
  const sync = () => hook.rerender({ h: history });
  return {
    tabs,
    commits,
    present: () => history.present,
    change: (next: KnowledgeStyle) => {
      act(() => void changeKnowledgeStyle(next));
      sync();
    },
    edit: () => {
      history = historyCommit(history, (ts) => {
        commits();
        return ts.map((t, i) => (i === 0 ? { ...t, name: `${t.name}!` } : t));
      });
      sync();
    },
    undo: () => {
      act(() => hook.result.current.beforeUndo());
      history = historyUndo(history);
      sync();
    },
    redo: () => {
      act(() => hook.result.current.beforeRedo());
      history = historyRedo(history);
      sync();
    },
  };
}

describe('a Knowledgebase Style change', () => {
  it('is shown at once and saved once, as the style alone', () => {
    const kb = setUp();
    kb.change(STEEL);
    expect(knowledgeStyleStore.styleOf('kb')).toEqual(STEEL);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('user_o', 'kb', STEEL, null);
  });

  it('rewrites and saves no page, and lays out none that is not on screen', () => {
    const kb = setUp(true, 200);
    for (const style of [STEEL, OCEAN, { ...OCEAN, textSize: 'large' as const }]) kb.change(style);
    // Every page is the very object it was: nothing for autosave to see, whatever the knowledgebase holds.
    expect(kb.present()).toBe(kb.tabs);
    kb.present().forEach((tab, i) => expect(tab).toBe(kb.tabs[i]));
    expect(kb.commits).not.toHaveBeenCalled();
    expect(saveTab).not.toHaveBeenCalled();
    expect(layOut).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(3);
  });

  it('is one undo step: undo puts the style back, redo sets it again, and no page changes either way', () => {
    const kb = setUp();
    kb.change(STEEL);
    kb.undo();
    expect(knowledgeStyleStore.styleOf('kb')).toEqual(DEFAULT_KNOWLEDGE_STYLE);
    kb.present().forEach((tab, i) => expect(tab).toBe(kb.tabs[i]));
    kb.redo();
    expect(knowledgeStyleStore.styleOf('kb')).toEqual(STEEL);
    kb.present().forEach((tab, i) => expect(tab).toBe(kb.tabs[i]));
    // The change, its undo and its redo: three saves of the style, none of a page.
    expect(save).toHaveBeenCalledTimes(3);
    expect(saveTab).not.toHaveBeenCalled();
  });

  it('keeps its place among page edits: undoing a later edit leaves the style, the next undo takes it back', () => {
    const kb = setUp();
    kb.change(STEEL);
    kb.edit();
    kb.undo();
    expect(knowledgeStyleStore.styleOf('kb')).toEqual(STEEL);
    kb.undo();
    expect(knowledgeStyleStore.styleOf('kb')).toEqual(DEFAULT_KNOWLEDGE_STYLE);
    // A new edit made here forgets the style's redo, as it forgets every redo.
    kb.edit();
    kb.redo();
    expect(knowledgeStyleStore.styleOf('kb')).toEqual(DEFAULT_KNOWLEDGE_STYLE);
  });

  it('puts back what was there when the save is refused, and says so', async () => {
    save.mockRejectedValueOnce(new Error('403'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const kb = setUp();
    kb.change(STEEL);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(knowledgeStyleStore.styleOf('kb')).toEqual(DEFAULT_KNOWLEDGE_STYLE);
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/030-knowledgebase/page-surface.md "Share roles".
describe('who may change it', () => {
  it('an Editor changes the style', () => {
    const kb = setUp(true);
    kb.change(STEEL);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it.each(['a Participant', 'a Viewer'])('%s never does: the door is not bound', () => {
    setUp(false);
    let changed = true;
    act(() => {
      changed = changeKnowledgeStyle(STEEL);
    });
    expect(changed).toBe(false);
    expect(knowledgeStyleStore.styleOf('kb')).toBe(DEFAULT_KNOWLEDGE_STYLE);
    expect(save).not.toHaveBeenCalled();
  });
});
