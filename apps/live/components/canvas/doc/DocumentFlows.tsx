'use client';

// The writing of every document on the tab (docs/specs/007-editor/document-pages.md), in canvas
// space above the sheets and under the elements, so a zone's elements sit over the room the
// writing leaves for them. Each document's editor is its own (DocumentFlowEditor), loaded only
// once the tab has a document: the editor's code (ProseMirror) is not part of the canvas until a
// document asks for it.
import { lazy, Suspense, useMemo } from 'react';
import { docMarginPx, pageFillTone, pageIsDark, type LaidOutPage } from '@livediagram/document';
import type { IllustratePagesView } from '@/hooks/editor/useIllustratePages';
import { pagesClipPath } from '@/components/canvas/IllustratePageClip';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import type { DocInk } from '@/lib/doc/doc-style-vars';

const DocumentFlowEditor = lazy(() => import('./DocumentFlowEditor'));

export function DocumentFlows({
  view,
  zoom,
  interactive,
  onLinkRequest,
}: {
  view: IllustratePagesView;
  zoom: number;
  // Whether presses on the writing are the writing's (no drawing tool in hand, not zen).
  interactive: boolean;
  onLinkRequest: () => void;
}) {
  const docs = view.documents;
  const surface = useCanvasSurface();
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
  if (!docs || byFlow.size === 0) return null;
  return (
    // Cut off at the shown sheets' edges, as the elements are (IllustratePageClip): writing that
    // reaches past the last page waits there unseen for its page.
    <div
      data-page-clip=""
      className="absolute inset-0"
      style={{ clipPath: pagesClipPath(view.pages) }}
    >
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
              ink={inkOf(lead, surface)}
              themeAccent={view.themeAccent}
              margin={docMarginPx(doc.style)}
              onCommit={docs.onCommit}
              onLayout={docs.onLayout}
              onUndo={docs.undo}
              onRedo={docs.redo}
              onLinkRequest={onLinkRequest}
              onWritingPress={docs.onWritingPress}
              focusRequest={docs.focusRequest}
            />
          );
        })}
      </Suspense>
    </div>
  );
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
