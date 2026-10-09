'use client';

// A logo page's overlays in the canvas layer (docs/specs/007-editor/logo-pages.md): its
// construction guides over the artwork, where a drawing can start on them while a drawing tool is
// in hand, and, while Mirror While Drawing is on, the live twin of a marker stroke or a path being
// drawn. One mount in Canvas; each part draws nothing when it does not apply.
import type { RefObject } from 'react';
import type { IllustratePagesView } from '@/hooks/editor/useIllustratePages';
import { mirroredLogoPages } from '@/hooks/editor/useLogoTools';
import { isWhiteboardPenIntent, type PendingDraw } from '@/lib/draw-mode';
import type { LiveStroke } from '@/lib/live-stroke';
import { GuideSnapPoints } from './GuideSnapPoints';
import { LogoPageGuides } from './LogoPageGuides';
import { MirroredDraft, MirroredPathDraft } from './MirrorReflection';
import type { PathDraftView } from './path/PathDraftLayer';
import { WhiteboardPenPreview } from './whiteboard/WhiteboardPenPreview';

export function LogoCanvasOverlays({
  view,
  bare,
  pendingDraw,
  penStroke,
  pathDraft,
  ink,
  wrapperRef,
  zoom,
}: {
  view: IllustratePagesView;
  // Zen, presenting or the isometric view: no guides.
  bare: boolean;
  pendingDraw: PendingDraw | null;
  penStroke: LiveStroke | null;
  pathDraft: PathDraftView | null;
  ink: string;
  wrapperRef: RefObject<HTMLDivElement | null>;
  zoom: number;
}) {
  const mirrorPages = mirroredLogoPages(view.pages, view.logo);
  return (
    <>
      <LogoPageGuides view={view} bare={bare} />
      {view.logo && view.edit ? (
        <GuideSnapPoints
          pages={view.pages}
          tools={view.logo}
          pendingDraw={pendingDraw}
          wrapperRef={wrapperRef}
          zoom={zoom}
        />
      ) : null}
      {penStroke && isWhiteboardPenIntent(pendingDraw) && mirrorPages ? (
        <MirroredDraft pages={mirrorPages} at={penStroke.points[0]}>
          <WhiteboardPenPreview stroke={penStroke} pen={pendingDraw} ink={ink} zoom={zoom} />
        </MirroredDraft>
      ) : null}
      {pathDraft && mirrorPages ? <MirroredPathDraft view={pathDraft} pages={mirrorPages} /> : null}
    </>
  );
}
