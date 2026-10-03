// The articles on the active tab's pages (docs/specs/007-editor/article-pages.md): their writing
// for the editors that draw it, and what those editors report back. A commit of the writing is one
// tab edit (one undo step, synced block by block); the layout's consequences (pages added or
// removed as the writing grows or shrinks, zones' elements moved with their zones) are settled by
// whoever made the change, folded into the step that caused them (tick), so the change and its
// consequences undo as one.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  articleMarginPx,
  articlesOf,
  illustratePagesOf,
  layOutIllustratePages,
  withArticleFlow,
  withZoneLanded,
  withZoneSize,
  withNotesSettled,
  articleNoteCorner,
  newArticleNote,
  type ArticleNoteKind,
  withElementsMoved,
  zoneCanvasRect,
  zoneMemberIds,
  type ArticleZoneBlock,
  type Element,
  withZoneRemoved,
  withZoneReleased,
  withElementsIntoZone,
  zonePlanFor,
  withZoneWrap,
  type ArticleZoneAlign,
  type ArticleZoneWrap,
  type ArticleLookId,
  type ArticleStyle,
  withArticleStyleChanged,
  withArticlePageCount,
  withZonesSettled,
  type ArticleBlock,
  type ArticleFlow,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';
import { useArticleIntake } from './useArticleIntake';
import { articleHandleOf, markZoneReleased } from '@/lib/article/article-editor-store';
import { flowFrame } from '@/lib/article/article-flow-geometry';
import { track } from '@/lib/telemetry';
import type { FlowLayout, FocusRequest } from '@/components/canvas/article/ArticleEditor';

export type ArticlesView = {
  // Each article's writing, by its id.
  flows: Readonly<Record<string, ArticleFlow>>;
  // Whether this person may write (an editor, the tab not locked).
  editable: boolean;
  onCommit: (flow: string, blocks: ArticleBlock[]) => void;
  onLayout: (layout: FlowLayout) => void;
  undo: () => void;
  redo: () => void;
  focusRequest: FocusRequest;
  requestFocus: (flow: string, at: 'start' | 'end') => void;
  // A press on the writing: the canvas's selection goes.
  onWritingPress: () => void;
  // Insert at the caret (the page toolbar): an empty drawing, or an object the writing takes in.
  insertObject: (flow: string, what: ArticleInsert) => void;
  // A zone's wrap, place across the text, size, or removal (the zone bar, its grips).
  zoneAction: (flow: string, zoneId: string, action: ZoneAction) => void;
  // Floating elements on an article page (none in a zone) put into the writing, in line or wrapped,
  // at the block boundary nearest them.
  embed: (flow: string, ids: readonly string[], wrap: ArticleZoneWrap) => void;
  // A comment or an action put on the selected text: a marker in the margin beside it, opened.
  addNote: (flow: string, kind: ArticleNoteKind) => void;
  // A zone dragged to the block boundary nearest a canvas point, its elements with it.
  moveZone: (flow: string, zoneId: string, near: { x: number; y: number }) => void;
  // An article's style changed (the Style tab): a look, or one field.
  setStyle: (flow: string, change: ArticleStyleChange) => void;
  // A style shown on an article while a Style tab choice is hovered.
  stylePreview: { flow: string; style: ArticleStyle } | null;
  setStylePreview: (preview: { flow: string; style: ArticleStyle } | null) => void;
};

// What each insert places at the caret (the writing then takes it into a zone).
const PLACE_INTENT = {
  image: { type: 'image' },
  table: { type: 'table' },
  chart: { type: 'shape', kind: 'bar-chart' },
  pie: { type: 'shape', kind: 'pie-chart' },
  line: { type: 'shape', kind: 'line-chart' },
  callout: { type: 'shape', kind: 'callout' },
  sticky: { type: 'sticky' },
} as const;

// Telemetry (docs/specs/007-editor/article-pages.md "Telemetry"): what was inserted, which look.
const INSERT_EVENT = {
  image: 'ArticleImage',
  table: 'ArticleTable',
  chart: 'ArticleChart',
  pie: 'ArticleChart',
  line: 'ArticleChart',
  callout: 'ArticleCallout',
  sticky: 'ArticleSticky',
  drawing: 'ArticleDrawing',
} as const;
const LOOK_EVENT = {
  clean: 'ArticleLookClean',
  classic: 'ArticleLookClassic',
  report: 'ArticleLookReport',
  notebook: 'ArticleLookNotebook',
  bold: 'ArticleLookBold',
} as const;

export type ArticleStyleChange = { look: ArticleLookId } | { patch: Partial<ArticleStyle> };

export type ArticleInsert =
  'image' | 'table' | 'chart' | 'pie' | 'line' | 'callout' | 'sticky' | 'drawing';
export type ZoneAction =
  | { wrap: ArticleZoneWrap }
  | { align: ArticleZoneAlign }
  | { size: { width?: number; height?: number } }
  | { float: true }
  | { remove: true };

// A new drawing's height before anything is drawn in it.
const NEW_DRAWING_HEIGHT = 240;

export function useArticles(deps: {
  activeTab: Tab;
  on: boolean;
  // The pages laid out (null outside Illustrate mode).
  pages: readonly LaidOutPage[] | null;
  // This person's own edits, counted (useArticleIntake settles after each).
  localEditSeq: RefObject<number>;
  // An element of its default size put at a canvas point (useElementCreation placeIntentAt).
  placeAt: (
    intent: (typeof PLACE_INTENT)[Exclude<ArticleInsert, 'drawing'>],
    x: number,
    y: number,
  ) => void;
  canEdit: boolean;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  tickTabs: (map: (ts: Tab[]) => Tab[]) => void;
  undo: () => void;
  redo: () => void;
  clearSelection: () => void;
  // A margin note's marker opened as made: its comment thread, or the Assign Action dialog.
  openNote: (id: string, kind: ArticleNoteKind) => void;
}): ArticlesView | null {
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
    (flow: string, blocks: ArticleBlock[]) => {
      const d = latest.current;
      if (!d.canEdit || d.activeTab.locked === true) return;
      d.commitTabs((ts) =>
        ts.map((t) => {
          if (t.id !== tabId || t.locked === true) return t;
          const doc = articlesOf(t)[flow];
          // An article deleted meanwhile takes no writing.
          if (!doc) return t;
          return withArticleFlow(t, flow, doc.style ? { blocks, style: doc.style } : { blocks });
        }),
      );
      debugLog('[article] writing committed', { tabId, flow, blocks: blocks.length });
    },
    [tabId],
  );

  const onLayout = useCallback(
    (layout: FlowLayout) => {
      const d = latest.current;
      if (!layout.local || !d.canEdit || d.activeTab.locked === true) return;
      d.tickTabs((ts) => {
        const out = ts.map((t) => {
          if (t.id !== tabId || t.locked === true || !articlesOf(t)[layout.flow]) return t;
          const paged = withArticlePageCount(t, layout.flow, layout.pagesNeeded);
          const settled = withNotesSettled(
            withZonesSettled(paged, layout.flow, layout.zones),
            layout.flow,
            layout.notes,
          );
          if (settled !== t)
            debugLog('[article] layout settled', {
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

  useArticleIntake({
    activeTab,
    on,
    editable,
    pages: deps.pages,
    localEditSeq: deps.localEditSeq,
    tickTabs: deps.tickTabs,
  });

  const textWidth = (t: Tab, flow: string) => {
    const doc = articlesOf(t)[flow];
    const own = layOutIllustratePages(illustratePagesOf(t)).filter((p) => p.flow === flow);
    return doc && own.length ? flowFrame(own, articleMarginPx(doc.style)).columnWidth : 600;
  };

  const insertObject = useCallback(
    (flow: string, what: ArticleInsert) => {
      const d = latest.current;
      const handle = articleHandleOf(flow);
      if (!handle || !d.canEdit || d.activeTab.locked === true) return;
      track('Element', 'Added', INSERT_EVENT[what]);
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
      d.placeAt(PLACE_INTENT[what], at.x, at.y + 30);
    },
    [tabId],
  );

  const zoneAction = useCallback(
    (flow: string, zoneId: string, action: ZoneAction) => {
      const d = latest.current;
      if (!d.canEdit || d.activeTab.locked === true) return;
      if ('remove' in action) track('Element', 'Changed', 'ArticleZoneRemoved');
      else if ('float' in action) {
        track('Element', 'Changed', 'ArticleZoneFloat');
        markZoneReleased(zoneId);
      } else if ('size' in action) track('Element', 'Changed', 'ArticleZoneResized');
      else track('Element', 'Changed', 'ArticleZoneWrap');
      d.commitTabs((ts) =>
        ts.map((t) => {
          if (t.id !== tabId) return t;
          if ('remove' in action) return withZoneRemoved(t, flow, zoneId);
          if ('float' in action) return withZoneReleased(t, flow, zoneId);
          if ('size' in action)
            return withZoneSize(t, flow, zoneId, action.size, textWidth(t, flow));
          return withZoneWrap(t, flow, zoneId, action, textWidth(t, flow));
        }),
      );
      debugLog('[article] zone changed', { tabId, flow, zoneId, action });
    },
    [tabId],
  );

  const embed = useCallback(
    (flow: string, ids: readonly string[], wrap: ArticleZoneWrap) => {
      const d = latest.current;
      const handle = articleHandleOf(flow);
      if (!handle || !d.canEdit || d.activeTab.locked === true || ids.length === 0) return;
      const all = d.activeTab.elements;
      const els = all.filter((e) => ids.includes(e.id));
      const width = textWidth(d.activeTab, flow);
      const plan = zonePlanFor(els, all, width);
      const res = handle.insertZone(
        { zone: plan.zone, width: plan.width, height: plan.height },
        { x: plan.bounds.x + plan.bounds.width / 2, y: plan.bounds.y + plan.bounds.height / 2 },
      );
      if (!res) return;
      track('Element', 'Changed', 'ArticleZoneWrap');
      d.commitTabs((ts) =>
        ts.map((t) => {
          if (t.id !== tabId) return t;
          const landed = withZoneLanded(t, flow, res);
          if (!landed.rect) return landed.tab;
          let next = {
            ...landed.tab,
            elements: withElementsIntoZone(landed.tab.elements, new Set(ids), plan, landed.rect),
          };
          if (wrap !== 'inline') next = withZoneWrap(next, flow, res.id, { wrap }, width);
          return next;
        }),
      );
      debugLog('[article] floating elements put in the writing', { tabId, flow, wrap });
    },
    [tabId],
  );

  const addNote = useCallback(
    (flow: string, kind: ArticleNoteKind) => {
      const d = latest.current;
      const handle = articleHandleOf(flow);
      if (!handle || !d.canEdit || d.activeTab.locked === true) return;
      const id = crypto.randomUUID();
      const res = handle.markNote(id, kind);
      if (!res) return;
      track('Element', 'Added', kind === 'action' ? 'ArticleAction' : 'ArticleComment');
      d.commitTabs((ts) =>
        ts.map((t) => {
          if (t.id !== tabId) return t;
          const doc = articlesOf(t)[flow];
          const page = layOutIllustratePages(illustratePagesOf(t)).filter((p) => p.flow === flow)[
            res.place.index
          ];
          if (!doc || !page) return t;
          const corner = articleNoteCorner(page, articleMarginPx(doc.style), res.place);
          const written = withArticleFlow(
            t,
            flow,
            doc.style ? { blocks: res.blocks, style: doc.style } : { blocks: res.blocks },
          );
          return { ...written, elements: [...written.elements, newArticleNote(id, kind, corner)] };
        }),
      );
      d.openNote(id, kind);
      debugLog('[article] margin note added', { tabId, flow, kind });
    },
    [tabId],
  );

  const moveZone = useCallback(
    (flow: string, zoneId: string, near: { x: number; y: number }) => {
      const d = latest.current;
      const handle = articleHandleOf(flow);
      if (!handle || !d.canEdit || d.activeTab.locked === true) return;
      const res = handle.moveZone(zoneId, near);
      if (!res) return;
      track('Element', 'Changed', 'ArticleZoneMoved');
      d.commitTabs((ts) =>
        ts.map((t) => (t.id === tabId ? withZoneMoved(t, flow, zoneId, res) : t)),
      );
      debugLog('[article] zone moved', { tabId, flow, zoneId, index: res.index });
    },
    [tabId],
  );

  const [stylePreview, setStylePreview] = useState<ArticlesView['stylePreview']>(null);
  const setStyle = useCallback(
    (flow: string, change: ArticleStyleChange) => {
      const d = latest.current;
      if (!d.canEdit || d.activeTab.locked === true) return;
      track('Tab', 'Changed', 'look' in change ? LOOK_EVENT[change.look] : 'ArticleStyle');
      setStylePreview(null);
      d.commitTabs((ts) =>
        ts.map((t) => (t.id === tabId ? withArticleStyleChanged(t, flow, change) : t)),
      );
      debugLog('[article] style changed', { tabId, flow, change });
    },
    [tabId],
  );

  const undo = useCallback(() => latest.current.undo(), []);
  const redo = useCallback(() => latest.current.redo(), []);
  const onWritingPress = useCallback(() => latest.current.clearSelection(), []);

  if (!on) return null;
  return {
    flows: articlesOf(activeTab),
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
    embed,
    addNote,
    moveZone,
    setStyle,
    stylePreview,
    setStylePreview,
  };
}

// A zone moved in the writing (landed where the editor measured it), its elements carried from its
// old place to its new one in the same edit.
export function withZoneMoved(
  t: Tab,
  flow: string,
  zoneId: string,
  res: Parameters<typeof withZoneLanded>[2],
): Tab {
  const pagesOf = (tab: Tab) =>
    layOutIllustratePages(illustratePagesOf(tab)).filter((p) => p.flow === flow);
  const zoneOf = (tab: Tab) =>
    articlesOf(tab)[flow]?.blocks.find(
      (b): b is ArticleZoneBlock => b.id === zoneId && b.type === 'zone',
    );
  const before = zoneOf(t);
  const from = before ? zoneCanvasRect(pagesOf(t), before) : null;
  const landed = withZoneLanded(t, flow, res);
  if (!from || !landed.rect) return landed.tab;
  const ids = zoneMemberIds(t.elements as Element[], from);
  return {
    ...landed.tab,
    elements: withElementsMoved(
      landed.tab.elements as Element[],
      ids,
      landed.rect.x - from.x,
      landed.rect.y - from.y,
    ),
  };
}
