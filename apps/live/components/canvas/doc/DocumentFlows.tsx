'use client';

// The writing of every document on the tab (docs/specs/007-editor/document-pages.md), in canvas
// space above the sheets and under the elements, so a zone's elements sit over the room the
// writing leaves for them. Each document's editor is its own (DocumentFlowEditor), loaded only
// once the tab has a document: the editor's code (ProseMirror) is not part of the canvas until a
// document asks for it.
import { lazy, Suspense, useMemo } from 'react';
import {
  docMarginPx,
  pageFillTone,
  pageIsDark,
  zoneAnchorOf,
  zoneCanvasRect,
  type DocZoneBlock,
  type Element,
  type LaidOutPage,
  type PageRect,
} from '@livediagram/document';
import type { IllustratePagesView } from '@/hooks/editor/useIllustratePages';
import { pagesClipPath } from '@/components/canvas/IllustratePageClip';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import type { DocInk } from '@/lib/doc/doc-style-vars';
import { docHandleOf, requestDocLink, useActiveDoc } from '@/lib/doc/doc-editor-store';
import { PageToolbar } from './PageToolbar';
import { previewedBackground, usePageBackgroundPreview } from '@/lib/page-background-preview';
import { ZoneBar, ZoneResizeGrip } from './ZoneBar';

const DocumentFlowEditor = lazy(() => import('./DocumentFlowEditor'));

export function DocumentFlows({
  view,
  zoom,
  interactive,
  selectedIds,
  elements,
}: {
  view: IllustratePagesView;
  zoom: number;
  // Whether presses on the writing are the writing's (no drawing tool in hand, not zen).
  interactive: boolean;
  // The canvas's selection and elements: a selection all in one zone shows its zone bar.
  selectedIds: ReadonlySet<string>;
  elements: readonly Element[];
}) {
  const docs = view.documents;
  const surface = useCanvasSurface();
  // A background hovered in a page's panel inks the writing as it would on the press.
  const preview = usePageBackgroundPreview();
  // Each document's pages, in order, kept by identity while the pages are.
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
  const active = useActiveDoc();
  const target = docs?.editable
    ? zoneTarget(
        byFlow,
        docs.docs,
        active?.selection.zoneId ?? null,
        active?.handle.flow ?? null,
        selectedIds,
        elements,
      )
    : null;
  if (!docs || byFlow.size === 0) return null;
  return (
    <>
      {/* Cut off at the shown sheets' edges, as the elements are (IllustratePageClip): writing that
          reaches past the last page waits there unseen for its page. */}
      <div
        data-page-clip=""
        className="absolute inset-0"
        style={{ clipPath: pagesClipPath(view.pages) }}
      >
        {/* A press on a document page's blank paper (its margins, below the writing) puts the
            caret at the writing nearest it, as on a page of a word processor. */}
        {docs.editable && interactive
          ? [...byFlow].flatMap(([flow, pages]) =>
              pages
                .filter((p) => view.pages.some((shown) => shown.id === p.id))
                .map((p) => (
                  <div
                    key={p.id}
                    aria-hidden
                    data-doc-paper=""
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
                      docs.onWritingPress();
                      docHandleOf(flow)?.focusAt(e.clientX, e.clientY);
                    }}
                  />
                )),
            )
          : null}
        <Suspense fallback={null}>
          {[...byFlow].map(([flow, pages]) => {
            const doc = docs.docs[flow];
            if (!doc) return null;
            const lead = pages[0]!;
            return (
              <DocumentFlowEditor
                key={flow}
                flow={flow}
                pages={pages}
                doc={doc}
                editable={docs.editable}
                interactive={interactive}
                zoom={zoom}
                ink={inkOf(
                  { ...lead, background: previewedBackground(lead, pages, preview) },
                  surface,
                )}
                themeAccent={view.themeAccent}
                styleOverride={
                  docs.stylePreview?.flow === flow ? docs.stylePreview.style : undefined
                }
                margin={docMarginPx(
                  docs.stylePreview?.flow === flow ? docs.stylePreview.style : doc.style,
                )}
                onCommit={docs.onCommit}
                onLayout={docs.onLayout}
                onUndo={docs.undo}
                onRedo={docs.redo}
                onLinkRequest={requestDocLink}
                onInsert={docs.insertObject}
                onWritingPress={docs.onWritingPress}
                focusRequest={docs.focusRequest}
              />
            );
          })}
        </Suspense>
        {docs.editable ? (
          <PageToolbar
            accent={view.themeAccent}
            onInsert={(what) => {
              if (active) docs.insertObject(active.handle.flow, what);
            }}
          />
        ) : null}
      </div>
      {target && target.zone.zone === 'drawing' ? (
        <ZoneResizeGrip
          zoneId={target.zone.id}
          rect={target.rect}
          zoom={zoom}
          onResize={(height) => docs.zoneAction(target.flow, target.zone.id, { height })}
        />
      ) : null}
      {target ? (
        <ZoneBar
          zone={target.zone}
          rect={target.rect}
          zoom={zoom}
          onAction={(action) => docs.zoneAction(target.flow, target.zone.id, action)}
        />
      ) : null}
    </>
  );
}

// The zone a zone bar is for: the one selected whole in the writing, else the one every selected
// element is in.
function zoneTarget(
  byFlow: ReadonlyMap<string, LaidOutPage[]>,
  docs: Readonly<Record<string, import('@livediagram/document').DocFlow>>,
  zoneId: string | null,
  zoneFlow: string | null,
  selectedIds: ReadonlySet<string>,
  elements: readonly Element[],
): { flow: string; zone: DocZoneBlock; rect: PageRect } | null {
  const zonesOf = (flow: string) =>
    (docs[flow]?.blocks ?? []).filter((b): b is DocZoneBlock => b.type === 'zone');
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
const inkCache = new Map<string, DocInk>();
function inkOf(page: LaidOutPage, surface: 'light' | 'dark'): DocInk {
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
