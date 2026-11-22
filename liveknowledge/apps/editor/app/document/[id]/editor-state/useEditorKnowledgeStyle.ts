import { useEffect, useState } from 'react';
import type { KnowledgeStyle } from '@liveknowledge/document';
import { apiSaveKnowledgeStyle } from '@/lib/api/knowledge-style';
import { knowledgeStyleStore } from '@/lib/knowledge-style/knowledge-style-store';
import { bindStyleChange } from '@/lib/knowledge-style/style-change';
import { createStyleHistory } from '@/lib/knowledge-style/style-history';
import { useToast } from '@/hooks/ui/useToast';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

// The Knowledgebase Style as an edit (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"): a change
// is shown at once from the style store, saved through the document's metadata write, and is one undo step that
// leaves every tab as it is (lib/knowledge-style/style-history.ts). No tab is committed, so no page is saved and
// only mounted pages redraw. Editor only: the door is bound for an Editor of the whole knowledgebase and for no
// one else, and the api and the room refuse the rest.
//
// One slice of useEditorState (../useEditorState.ts).
export function useEditorKnowledgeStyle(opts: {
  documentId: string | null;
  ownerId: string;
  shareCode: string | null;
  // An Editor of the whole knowledgebase, outside an embed (components/knowledge-style/useStyleOffered.ts).
  mayStyle: boolean;
  depth: number;
  branch: number;
  markCheckpoint: () => void;
}) {
  const { documentId, mayStyle, depth, branch } = opts;
  const toast = useToast();
  const latest = useLatest({ ...opts, onSaveFailed: toast.error });
  const [history] = useState(createStyleHistory);
  // The history as this render left it: a step a new edit overwrote is forgotten.
  useEffect(() => history.sync(depth, branch), [history, depth, branch]);
  // Another knowledgebase has its own history, and is the one whose style the exports read.
  useEffect(() => {
    knowledgeStyleStore.setOpen(documentId);
    return () => {
      knowledgeStyleStore.setOpen(null);
      history.clear();
    };
  }, [documentId, history]);

  // Shown at once, then saved. A save the api refuses puts back what was there and says so.
  const apply = (next: KnowledgeStyle) => {
    const { documentId: id, ownerId, shareCode, onSaveFailed } = latest.current;
    if (!id) return;
    const before = knowledgeStyleStore.styleOf(id);
    if (!knowledgeStyleStore.set(id, next)) return;
    apiSaveKnowledgeStyle(ownerId, id, next, shareCode).catch((err: unknown) => {
      console.warn('[knowledge-style] save failed', { documentId: id, error: String(err) });
      // Only when nothing newer was chosen meanwhile.
      if (knowledgeStyleStore.styleOf(id) === next) knowledgeStyleStore.set(id, before);
      onSaveFailed('The style could not be saved. Check your connection and try again.');
    });
  };
  const applyRef = useLatest(apply);

  useEffect(() => {
    if (!documentId || !mayStyle) return;
    bindStyleChange((next) => {
      const { documentId: id, markCheckpoint } = latest.current;
      if (!id) return;
      const before = knowledgeStyleStore.styleOf(id);
      if (before === next) return;
      // The step: the tabs as they are, the style before and after against it.
      markCheckpoint();
      history.record(before, next);
      applyRef.current(next);
    });
    return () => bindStyleChange(null);
  }, [documentId, mayStyle, history, latest, applyRef]);

  return {
    /** Before the history steps back: the style the step being undone replaced goes back with it. */
    beforeUndo: () => {
      const style = history.undoing();
      if (style && latest.current.mayStyle) applyRef.current(style);
    },
    beforeRedo: () => {
      const style = history.redoing();
      if (style && latest.current.mayStyle) applyRef.current(style);
    },
  };
}
