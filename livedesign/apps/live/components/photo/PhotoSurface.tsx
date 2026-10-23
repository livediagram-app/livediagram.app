'use client';

// The photo in focus drawn on its page's sheet (docs/specs/031-photo/photo-pages.md "Working on a
// photo page"): a canvas over the part of the sheet on screen, drawn by the SurfacePainter on the next
// frame after the view moves or the session reports a change.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LaidOutPage } from '@livedesign/design';
import type { PhotoSession } from '@/lib/photo-editor/session';
import { SurfacePainter } from '@/lib/photo-editor/surface-painter';
import { photoViewOptions } from '@/lib/photo-editor/view-options';

export function PhotoSurface({
  page,
  session,
  zoom,
  viewKey,
}: {
  page: LaidOutPage;
  session: PhotoSession;
  zoom: number;
  // Changes as the view pans.
  viewKey: unknown;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [painter] = useState(() => new SurfacePainter());
  const { width, height } = page.rect;
  useLayoutEffect(() => {
    if (hostRef.current && canvasRef.current) painter.attach(hostRef.current, canvasRef.current);
    painter.update(session, { width, height });
    painter.schedule();
  }, [painter, session, width, height, zoom, viewKey]);
  useEffect(() => {
    window.addEventListener('resize', painter.schedule);
    // The pixel grid toggled: drawn again.
    const offView = photoViewOptions.subscribe(painter.schedule);
    return () => {
      window.removeEventListener('resize', painter.schedule);
      offView();
      painter.dispose();
    };
  }, [painter]);
  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0" data-photo-surface="">
      <canvas ref={canvasRef} className="absolute" />
    </div>
  );
}
