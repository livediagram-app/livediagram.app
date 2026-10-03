// The documents on the active tab's pages (docs/specs/007-editor/document-pages.md): their writing
// for the editors that draw it, and what those editors report back. A commit of the writing is one
// tab edit (one undo step, synced block by block); the layout's consequences (pages added or
// removed as the writing grows or shrinks, zones' elements moved with their zones) are settled by
// whoever made the change, folded into the step that caused them (tick), so the change and its
// consequences undo as one.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  docsOf,
  withDocFlow,
  withDocumentPageCount,
  withZonesSettled,
  type DocBlock,
  type DocFlow,
  type Tab,
} from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';
import type { FlowLayout, FocusRequest } from '@/components/canvas/doc/DocumentFlowEditor';

export type DocumentPagesView = {
  docs: Readonly<Record<string, DocFlow>>;
  // Whether this person may write (an editor, the tab not locked).
  editable: boolean;
  onCommit: (flow: string, blocks: DocBlock[]) => void;
  onLayout: (layout: FlowLayout) => void;
  undo: () => void;
  redo: () => void;
  focusRequest: FocusRequest;
  requestFocus: (flow: string, at: 'start' | 'end') => void;
  // A press on the writing: the canvas's selection goes.
  onWritingPress: () => void;
};

export function useDocumentPages(deps: {
  activeTab: Tab;
  on: boolean;
  canEdit: boolean;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  tickTabs: (map: (ts: Tab[]) => Tab[]) => void;
  undo: () => void;
  redo: () => void;
  clearSelection: () => void;
}): DocumentPagesView | null {
  const { activeTab, on, canEdit } = deps;
  const tabId = activeTab.id;
  const editable = canEdit && activeTab.locked !== true;
  const latest = useRef(deps);
  useEffect(() => {
    latest.current = deps;
  });
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null);
  const seq = useRef(0);
  const requestFocus = useCallback((flow: string, at: 'start' | 'end') => {
    seq.current += 1;
    setFocusRequest({ flow, at, seq: seq.current });
  }, []);

  const onCommit = useCallback(
    (flow: string, blocks: DocBlock[]) => {
      const d = latest.current;
      if (!d.canEdit || d.activeTab.locked === true) return;
      d.commitTabs((ts) =>
        ts.map((t) => {
          if (t.id !== tabId || t.locked === true) return t;
          const doc = docsOf(t)[flow];
          // A document deleted meanwhile takes no writing.
          if (!doc) return t;
          return withDocFlow(t, flow, doc.style ? { blocks, style: doc.style } : { blocks });
        }),
      );
      debugLog('[doc] writing committed', { tabId, flow, blocks: blocks.length });
    },
    [tabId],
  );

  const onLayout = useCallback(
    (layout: FlowLayout) => {
      const d = latest.current;
      if (!layout.local || !d.canEdit || d.activeTab.locked === true) return;
      d.tickTabs((ts) =>
        ts.map((t) => {
          if (t.id !== tabId || t.locked === true || !docsOf(t)[layout.flow]) return t;
          const paged = withDocumentPageCount(t, layout.flow, layout.pagesNeeded);
          const settled = withZonesSettled(paged, layout.flow, layout.zones);
          if (settled !== t)
            debugLog('[doc] layout settled', {
              tabId,
              flow: layout.flow,
              pages: layout.pagesNeeded,
            });
          return settled;
        }),
      );
    },
    [tabId],
  );

  const undo = useCallback(() => latest.current.undo(), []);
  const redo = useCallback(() => latest.current.redo(), []);
  const onWritingPress = useCallback(() => latest.current.clearSelection(), []);

  if (!on) return null;
  return {
    docs: docsOf(activeTab),
    editable,
    onCommit,
    onLayout,
    undo,
    redo,
    focusRequest,
    requestFocus,
    onWritingPress,
  };
}
