'use client';

// The writing of every article on the tab (docs/specs/007-editor/article-pages.md), in canvas
// space above the sheets and under the elements, so a zone's elements sit over the room the
// writing leaves for them. Each article's editor is its own (ArticleEditor), loaded only
// once the tab has an article: the editor's code (ProseMirror) is not part of the canvas until an
// article asks for it.
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo } from 'react';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import {
  articleMarginPx,
  MAX_ILLUSTRATE_PAGES,
  articleTopMarginPx,
  drawingZoneClips,
  isBoxed,
  isDrawingElement,
  pageFillTone,
  pageIsDark,
  zoneAnchorOf,
  zoneCanvasRect,
  type ArticleZoneBlock,
  type Element,
  type LaidOutPage,
  type PageRect,
} from '@livediagram/document';
import type { IllustratePagesView } from '@/hooks/editor/useIllustratePages';
import { pagesClipPath } from '@/components/canvas/IllustratePageClip';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import type { ArticleInk } from '@/lib/article/article-style-vars';
import {
  articleHandleOf,
  requestArticleLink,
  useActiveArticle,
} from '@/lib/article/article-editor-store';
import { previewedBackground, usePageBackgroundPreview } from '@/lib/page-background-preview';
import { ZoneBar, ZoneResizeGrips } from './ZoneBar';
import { useZoneDrag, type ZoneDragState } from './useZoneDrag';
import { useObjectDropCaret } from './useObjectDropCaret';
import { useTouchPagePan } from './useTouchPagePan';
import { publishZoneClips } from '@/lib/article/zone-clip-store';
import { selectionMoving, useCanvasGesture } from '@/lib/canvas-gesture';
import { useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import type { Selection } from '@/lib/selection-store';

const selectionAsSet = (s: Selection): ReadonlySet<string> =>
  new Set([...s.multiSelectedIds, ...(s.selectedId ? [s.selectedId] : [])]);
const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

const ArticleEditor = lazy(() => import('./ArticleEditor'));
// The toolbar drives the writing's commands (ProseMirror), so it loads with the editor, not with
// the canvas.
const PageToolbar = lazy(() => import('./PageToolbar').then((m) => ({ default: m.PageToolbar })));

export function ArticleFlows({
  view,
  zoom,
  interactive,
  elements,
}: {
  view: IllustratePagesView;
  zoom: number;
  // Whether presses on the writing are the writing's (no drawing tool in hand, not zen).
  interactive: boolean;
  // The canvas's elements: a selection all in one zone shows its zone bar.
  elements: readonly Element[];
}) {
  // The selection as one set, read from the store here so the canvas doesn't re-render for it
  // (docs/specs/008-canvas/blueprints/selection-store.md).
  const selectedIds = useSelectionOf(selectionAsSet, sameIds);
  const articles = view.articles;
  const surface = useCanvasSurface();
  // A background hovered in a page's panel inks the writing as it would on the press.
  const preview = usePageBackgroundPreview();
  // Each article's pages, in order, kept by identity while the pages are.
  const row = view.rowPages ?? view.pages;
  const byFlow = useMemo(() => {
    const out = new Map<string, LaidOutPage[]>();
    for (const p of row) {
      if (!p.flow) continue;
      const run = out.get(p.flow);
      if (run) run.push(p);
      else out.set(p.flow, [p]);
    }
    return out;
  }, [row]);
  const active = useActiveArticle();
  // Derived once per change of what they read (the writing, the selection, the board), never per
  // canvas render: `flows` keeps its identity while the writing does (articlesOf's cache).
  const flows = articles?.flows;
  const editable = articles?.editable === true;
  const zoneId = active?.focused ? active.selection.zoneId : null;
  const zoneFlow = active?.handle.flow ?? null;
  const target = useMemo(
    () =>
      editable && flows ? zoneTarget(byFlow, flows, zoneId, zoneFlow, selectedIds, elements) : null,
    [editable, flows, byFlow, zoneId, zoneFlow, selectedIds, elements],
  );
  const articlePages = useMemo(
    () => row.flatMap((p) => (p.flow ? [{ id: p.id, flow: p.flow }] : [])),
    [row],
  );
  const zoneDrag = useZoneDrag({
    zoom,
    pagesOf: (flow) => byFlow.get(flow),
    onMove: (flow, zoneId, near) => articles?.moveZone(flow, zoneId, near),
  });
  const floating = useMemo(
    () =>
      editable && flows && !target ? floatingTarget(byFlow, flows, selectedIds, elements) : null,
    [editable, flows, target, byFlow, selectedIds, elements],
  );
  // A drawing zone cuts off what of its drawing pokes past its edge; what is being moved shows
  // whole until it lands (it may be leaving the zone).
  const moving = selectionMoving(useCanvasGesture());
  const clips = useMemo(() => {
    const all = flows
      ? drawingZoneClips(row, flows, elements, isDrawingElement)
      : new Map<string, PageRect>();
    if (moving) for (const id of selectedIds) all.delete(id);
    return all;
  }, [row, flows, elements, moving, selectedIds]);
  useLayoutEffect(() => publishZoneClips(clips), [clips]);
  useLayoutEffect(() => () => publishZoneClips(new Map()), []);
  // On a phone, the writing taking the caret frames its page for writing: its text column across
  // the screen (once per time it takes focus).
  const mobile = useIsMobileViewport();
  const focusedPage = active?.focused ? active.pageId : null;
  const readPage = view.readPage;
  useEffect(() => {
    if (mobile && focusedPage) readPage(focusedPage);
    // Framed when the focus arrives, not as the caret moves between pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, !!focusedPage]);
  // A finger on the writing or its paper pans the view when it travels; a tap is the writing's.
  const touchPress = useTouchPagePan(view.panFrom);
  const objectCaret = useObjectDropCaret({
    target,
    selectedIds,
    zoom,
    pagesOf: (flow) => byFlow.get(flow),
  });
  if (!articles || byFlow.size === 0) return null;
  return (
    <>
      {/* Cut off at the shown sheets' edges, as the elements are (IllustratePageClip): writing that
          reaches past the last page waits there unseen for its page. */}
      <div
        data-page-clip=""
        className="absolute inset-0"
        style={{ clipPath: pagesClipPath(view.pages) }}
      >
        {/* A press on an article page's blank paper (its margins, below the writing) puts the
            caret at the writing nearest it, as on a page of a word processor; a finger does so
            on its tap, and pans the view when it travels. */}
        {articles.editable && interactive
          ? [...byFlow].flatMap(([flow, pages]) =>
              pages
                .filter((p) => view.pages.some((shown) => shown.id === p.id))
                .map((p) => (
                  <div
                    key={p.id}
                    aria-hidden
                    data-article-paper=""
                    className="absolute cursor-text"
                    style={{
                      left: p.rect.x,
                      top: p.rect.y,
                      width: p.rect.width,
                      height: p.rect.height,
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      e.preventDefault();
                      const { clientX, clientY } = e;
                      const take = () => {
                        articles.onWritingPress();
                        articleHandleOf(flow)?.focusAt(clientX, clientY);
                      };
                      if (!touchPress(e, take)) take();
                    }}
                  />
                )),
            )
          : null}
        <Suspense fallback={null}>
          {[...byFlow].map(([flow, pages]) => {
            const doc = articles.flows[flow];
            if (!doc) return null;
            const lead = pages[0]!;
            return (
              <ArticleEditor
                key={flow}
                flow={flow}
                pages={pages}
                atPageLimit={row.length >= MAX_ILLUSTRATE_PAGES}
                doc={doc}
                editable={articles.editable}
                interactive={interactive}
                zoom={zoom}
                ink={inkOf(
                  { ...lead, background: previewedBackground(lead, pages, preview) },
                  surface,
                )}
                themeAccent={view.themeAccent}
                styleOverride={
                  articles.stylePreview?.flow === flow ? articles.stylePreview.style : undefined
                }
                margin={articleMarginPx(
                  articles.stylePreview?.flow === flow ? articles.stylePreview.style : doc.style,
                )}
                onCommit={articles.onCommit}
                onLayout={articles.onLayout}
                onUndo={articles.undo}
                onRedo={articles.redo}
                onLinkRequest={requestArticleLink}
                onNoteOpen={articles.openNote}
                onInsert={articles.insertObject}
                onWritingPress={articles.onWritingPress}
                onTouchPress={touchPress}
                focusRequest={articles.focusRequest}
                onFocusTaken={articles.focusTaken}
              />
            );
          })}
        </Suspense>
        {articles.editable ? (
          <Suspense fallback={null}>
            <PageToolbar
              accent={view.themeAccent}
              articlePages={articlePages}
              topRoomOf={(pageId) => {
                const flow = row.find((p) => p.id === pageId)?.flow;
                const doc = flow ? articles.flows[flow] : undefined;
                const preview = articles.stylePreview;
                const style = preview && preview.flow === flow ? preview.style : doc?.style;
                return articleTopMarginPx(style) * zoom;
              }}
              // For the article the toolbar shows for: the one worked on, or the one hovered.
              onInsert={articles.insertObject}
              onNote={articles.addNote}
            />
          </Suspense>
        ) : null}
      </div>
      {target && target.zone.zone === 'drawing' && !zoneDrag.drag ? (
        <ZoneResizeGrips
          zoneId={target.zone.id}
          rect={target.rect}
          zoom={zoom}
          onResize={(size) => articles.zoneAction(target.flow, target.zone.id, { size })}
        />
      ) : null}
      {target && !zoneDrag.drag ? (
        <ZoneBar
          fit={target.zone.wrap ?? 'inline'}
          align={target.zone.align ?? 'center'}
          drawing={target.zone.zone === 'drawing'}
          rect={target.rect}
          zoom={zoom}
          onFit={(fit) =>
            articles.zoneAction(
              target.flow,
              target.zone.id,
              fit === 'float' ? { float: true } : { wrap: fit },
            )
          }
          onAlign={(align) => articles.zoneAction(target.flow, target.zone.id, { align })}
          onRemove={() => articles.zoneAction(target.flow, target.zone.id, { remove: true })}
          onMoveStart={(e) => zoneDrag.start(e, target.flow, target.zone, target.rect)}
        />
      ) : null}
      {floating && !target && !zoneDrag.drag ? (
        <ZoneBar
          fit="float"
          align="center"
          drawing={false}
          rect={floating.rect}
          zoom={zoom}
          onFit={(fit) => {
            if (fit !== 'float') articles.embed(floating.flow, floating.ids, fit);
          }}
          onAlign={() => {}}
        />
      ) : null}
      {zoneDrag.drag ? <ZoneDragMarks drag={zoneDrag.drag} zoom={zoom} /> : null}
      {objectCaret ? <DropCaretMark caret={objectCaret} zoom={zoom} /> : null}
    </>
  );
}

// The zone a zone bar is for: the one selected whole in the writing, else the one every selected
// element is in.
function zoneTarget(
  byFlow: ReadonlyMap<string, LaidOutPage[]>,
  articles: Readonly<Record<string, import('@livediagram/document').ArticleFlow>>,
  zoneId: string | null,
  zoneFlow: string | null,
  selectedIds: ReadonlySet<string>,
  elements: readonly Element[],
): { flow: string; zone: ArticleZoneBlock; rect: PageRect } | null {
  const zonesOf = (flow: string) =>
    (articles[flow]?.blocks ?? []).filter((b): b is ArticleZoneBlock => b.type === 'zone');
  if (zoneId && zoneFlow) {
    const zone = zonesOf(zoneFlow).find((z) => z.id === zoneId);
    const rect = zone ? zoneCanvasRect(byFlow.get(zoneFlow) ?? [], zone) : null;
    if (zone && rect) return { flow: zoneFlow, zone, rect };
  }
  if (selectedIds.size === 0) return null;
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length === 0) return null;
  for (const [flow, pages] of byFlow) {
    for (const zone of zonesOf(flow)) {
      const rect = zoneCanvasRect(pages, zone);
      if (!rect) continue;
      const inside = selected.every((e) => {
        const p = zoneAnchorOf(e, elements as Element[]);
        return (
          p.x >= rect.x &&
          p.x <= rect.x + rect.width &&
          p.y >= rect.y &&
          p.y <= rect.y + rect.height
        );
      });
      if (inside) return { flow, zone, rect };
    }
  }
  return null;
}

// What the writing on a page is drawn against: its fill's tone, or the plain paper (white in light
// chrome, slate-900 in dark, as the sheet itself).
const inkCache = new Map<string, ArticleInk>();
function inkOf(page: LaidOutPage, surface: 'light' | 'dark'): ArticleInk {
  const fill = page.background?.fill;
  const tone = fill ? pageFillTone(fill) : surface === 'dark' ? '#0f172a' : '#ffffff';
  const dark = fill ? pageIsDark(page) : surface === 'dark';
  const key = `${tone}:${dark}`;
  let ink = inkCache.get(key);
  if (!ink) {
    ink = { tone, dark };
    inkCache.set(key, ink);
  }
  return ink;
}

// While a zone is dragged: its ghost under the pointer, and the caret where it would land.
function ZoneDragMarks({ drag, zoom }: { drag: ZoneDragState; zoom: number }) {
  return (
    <>
      <div
        aria-hidden
        data-zone-ghost=""
        className="pointer-events-none absolute rounded-md border-dashed border-brand-500 bg-brand-500/5"
        style={{
          left: drag.ghost.x,
          top: drag.ghost.y,
          width: drag.ghost.width,
          height: drag.ghost.height,
          borderWidth: 2 / zoom,
        }}
      />
      {drag.caret ? <DropCaretMark caret={drag.caret} zoom={zoom} /> : null}
    </>
  );
}

/** The drop caret: a brand line across the column at a block boundary, a dot at each end. */
function DropCaretMark({
  caret,
  zoom,
}: {
  caret: { x: number; y: number; width: number };
  zoom: number;
}) {
  const t = 3 / zoom;
  const dot = 9 / zoom;
  return (
    <div
      aria-hidden
      data-drop-caret=""
      className="pointer-events-none absolute"
      style={{ left: caret.x, top: caret.y - t / 2, width: caret.width, height: t }}
    >
      <span className="absolute inset-0 rounded-full bg-brand-500" />
      <span
        className="absolute rounded-full border-brand-500 bg-white dark:bg-slate-900"
        style={{ left: -dot / 2, top: t / 2 - dot / 2, width: dot, height: dot, borderWidth: t }}
      />
      <span
        className="absolute rounded-full border-brand-500 bg-white dark:bg-slate-900"
        style={{ right: -dot / 2, top: t / 2 - dot / 2, width: dot, height: dot, borderWidth: t }}
      />
    </div>
  );
}

// Elements floating on an article page (in no zone, every one on the same article's pages), all
// boxes: what a floating object's zone bar is for, with their bounds.
function floatingTarget(
  byFlow: ReadonlyMap<string, LaidOutPage[]>,
  articles: Readonly<Record<string, import('@livediagram/document').ArticleFlow>>,
  selectedIds: ReadonlySet<string>,
  elements: readonly Element[],
): { flow: string; ids: string[]; rect: PageRect } | null {
  if (selectedIds.size === 0) return null;
  const selected = elements.filter((e) => selectedIds.has(e.id));
  if (selected.length === 0 || !selected.every(isBoxed)) return null;
  const boxes = selected.filter(isBoxed);
  const within = (r: PageRect, p: { x: number; y: number }) =>
    p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
  const centre = (e: (typeof boxes)[number]) => ({ x: e.x + e.width / 2, y: e.y + e.height / 2 });
  for (const [flow, pages] of byFlow) {
    if (!boxes.every((e) => pages.some((p) => within(p.rect, centre(e))))) continue;
    const zones = (articles[flow]?.blocks ?? []).filter(
      (b): b is ArticleZoneBlock => b.type === 'zone',
    );
    const inZone = boxes.some((e) =>
      zones.some((z) => {
        const r = zoneCanvasRect(pages, z);
        return !!r && within(r, centre(e));
      }),
    );
    if (inZone) return null;
    const x = Math.min(...boxes.map((e) => e.x));
    const y = Math.min(...boxes.map((e) => e.y));
    const right = Math.max(...boxes.map((e) => e.x + e.width));
    const bottom = Math.max(...boxes.map((e) => e.y + e.height));
    return {
      flow,
      ids: boxes.map((e) => e.id),
      rect: { x, y, width: right - x, height: bottom - y },
    };
  }
  return null;
}
