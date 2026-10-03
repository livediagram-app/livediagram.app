// The documents on the active tab's pages (docs/specs/007-editor/document-pages.md): their writing
// for the editors that draw it, and what those editors report back. A commit of the writing is one
// tab edit (one undo step, synced block by block); the layout's consequences (pages added or
// removed as the writing grows or shrinks, zones' elements moved with their zones) are settled by
// whoever made the change, folded into the step that caused them (tick), so the change and its
// consequences undo as one.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  docMarginPx,
  docsOf,
  illustratePagesOf,
  layOutIllustratePages,
  withDocFlow,
  withZoneLanded,
  withZoneRemoved,
  withZoneWrap,
  type DocZoneAlign,
  type DocZoneWrap,
  withDocumentPageCount,
  withZonesSettled,
  type DocBlock,
  type DocFlow,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';
import { useDocumentIntake } from './useDocumentIntake';
import { docHandleOf } from '@/lib/doc/doc-editor-store';
import { flowFrame } from '@/lib/doc/doc-flow-geometry';
import { track } from '@/lib/telemetry';
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
  // Insert at the caret (the page toolbar): an empty drawing, or an object the writing takes in.
  insertObject: (flow: string, what: DocInsert) => void;
  // A zone's wrap, place across the text, or removal (the zone bar).
  zoneAction: (flow: string, zoneId: string, action: ZoneAction) => void;
};

export type DocInsert = 'image' | 'table' | 'chart' | 'drawing';
export type ZoneAction = { wrap: DocZoneWrap } | { align: DocZoneAlign } | { remove: true };

// A new drawing's height before anything is drawn in it.
const NEW_DRAWING_HEIGHT = 240;

export function useDocumentPages(deps: {
  activeTab: Tab;
  on: boolean;
  // The pages laid out (null outside Illustrate mode).
  pages: readonly LaidOutPage[] | null;
  // This person's own edits, counted (useDocumentIntake settles after each).
  localEditSeq: RefObject<number>;
  // An element of its default size put at a canvas point (useElementCreation placeIntentAt).
  placeAt: (
    intent: { type: 'shape'; kind: 'bar-chart' } | { type: 'table' } | { type: 'image' },
    x: number,
    y: number,
  ) => void;
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
      d.tickTabs((ts) => {
        const out = ts.map((t) => {
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
        });
        return out.every((t, i) => t === ts[i]) ? ts : out;
      });
    },
    [tabId],
  );

  useDocumentIntake({
    activeTab,
    on,
    editable,
    pages: deps.pages,
    localEditSeq: deps.localEditSeq,
    tickTabs: deps.tickTabs,
  });

  const textWidth = (t: Tab, flow: string) => {
    const doc = docsOf(t)[flow];
    const own = layOutIllustratePages(illustratePagesOf(t)).filter((p) => p.flow === flow);
    return doc && own.length ? flowFrame(own, docMarginPx(doc.style)).columnWidth : 600;
  };

  const insertObject = useCallback(
    (flow: string, what: DocInsert) => {
      const d = latest.current;
      const handle = docHandleOf(flow);
      if (!handle || !d.canEdit || d.activeTab.locked === true) return;
      track('Editor', 'Used', `Doc${what[0]!.toUpperCase()}${what.slice(1)}`);
      if (what === 'drawing') {
        const res = handle.insertZone(
          {
            zone: 'drawing',
            width: Math.round(textWidth(d.activeTab, flow)),
            height: NEW_DRAWING_HEIGHT,
          },
          null,
        );
        if (!res) return;
        d.commitTabs((ts) =>
          ts.map((t) => (t.id === tabId ? withZoneLanded(t, flow, res).tab : t)),
        );
        return;
      }
      const at = handle.caretCanvasPoint();
      if (!at) return;
      // Just under the caret's line, so the object lands after the block being written in.
      handle.flush();
      d.placeAt(
        what === 'chart'
          ? { type: 'shape', kind: 'bar-chart' }
          : what === 'table'
            ? { type: 'table' }
            : { type: 'image' },
        at.x,
        at.y + 30,
      );
    },
    [tabId],
  );

  const zoneAction = useCallback(
    (flow: string, zoneId: string, action: ZoneAction) => {
      const d = latest.current;
      if (!d.canEdit || d.activeTab.locked === true) return;
      if ('remove' in action) track('Element', 'Changed', 'DocZoneRemoved');
      else track('Element', 'Changed', 'DocZoneWrap');
      d.commitTabs((ts) =>
        ts.map((t) => {
          if (t.id !== tabId) return t;
          if ('remove' in action) return withZoneRemoved(t, flow, zoneId);
          return withZoneWrap(t, flow, zoneId, action, textWidth(t, flow));
        }),
      );
      debugLog('[doc] zone changed', { tabId, flow, zoneId, action });
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
    insertObject,
    zoneAction,
  };
}
