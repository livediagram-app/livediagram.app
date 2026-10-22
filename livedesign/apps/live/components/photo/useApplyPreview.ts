'use client';

// A filter's or an applied adjustment's dialog at work (docs/specs/031-photo/photo-adjustments.md
// "The Adjust tab" applied, "Filters"): what it works on is taken as the dialog opens; each change of
// its settings previews on the part of the photo on screen (a filter in the worker, the last one
// cancelled when the next starts); OK works the whole area and commits one edit; Cancel, or closing
// the dialog, puts the layer back.
import { useEffect, useRef, useState } from 'react';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import {
  adjustArea,
  cancelApplying,
  commitApplying,
  filterArea,
  startApplying,
  type Applying,
} from '@/lib/photo-editor/apply-ops';
import type { PhotoTaskHandle } from '@/lib/photo-editor/photo-worker-client';
import { visiblePart } from '@/lib/photo-editor/surface-painter';
import { photoTools } from '@/lib/photo-editor/tool-state';
import type { AdjustmentId } from '@livedesign/photo-engine';

// A preview starts this long after the last change, ms.
export const PREVIEW_DEBOUNCE_MS = 120;

/** The photo px on screen now, for a preview drawn on what shows. */
function visibleView(photo: PhotoEditorView) {
  const s = photo.session;
  const el = s ? document.querySelector(`[data-photo-page="${CSS.escape(s.pageId)}"]`) : null;
  if (!s || !el) return undefined;
  const r = el.getBoundingClientRect();
  return (
    visiblePart(
      r,
      { width: window.innerWidth, height: window.innerHeight },
      { width: r.width, height: r.height },
      s.photo,
      1,
    )?.view ?? undefined
  );
}

export type ApplyWork =
  | { kind: 'filter'; id: string; params: Record<string, unknown> }
  | { kind: 'adjust'; id: AdjustmentId; params: Record<string, unknown> };

export function useApplyPreview(photo: PhotoEditorView, work: ApplyWork, previewOn: boolean) {
  const [applying] = useState<Applying | string>(() =>
    photo.session ? startApplying(photo.session) : 'No photo in focus.',
  );
  const [progress, setProgress] = useState<number | null>(null);
  const handle = useRef<PhotoTaskHandle | null>(null);
  const done = useRef(false);
  const a = typeof applying === 'string' ? null : applying;

  // Each change previews, after a pause; a filter's previous run is cancelled.
  const key = JSON.stringify(work);
  useEffect(() => {
    const s = photo.session;
    if (!a || !s) return;
    if (!previewOn) {
      s.restorePixels(a.layerId, a.target, a.before.clone());
      return;
    }
    const t = setTimeout(() => {
      const view = visibleView(photo);
      if (work.kind === 'adjust') adjustArea(s, a, { id: work.id, params: work.params }, view);
      else {
        handle.current?.cancel();
        const run = filterArea(s, a, work.id, work.params, photoTools.get(), view, setProgress);
        handle.current = run.handle;
        void run.done.then(() => setProgress(null));
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // The settings, by value.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [key, previewOn, a]);

  // Closed without OK: the layer as it was.
  useEffect(
    () => () => {
      handle.current?.cancel();
      if (!done.current && a && photo.session) cancelApplying(photo.session, a);
    },
    // oxlint-disable-next-line react/exhaustive-deps
    [],
  );

  const ok = async (label: string): Promise<boolean> => {
    const s = photo.session;
    if (!a || !s) return false;
    handle.current?.cancel();
    if (work.kind === 'adjust') adjustArea(s, a, { id: work.id, params: work.params });
    else {
      setProgress(0);
      const run = filterArea(s, a, work.id, work.params, photoTools.get(), undefined, setProgress);
      handle.current = run.handle;
      const finished = await run.done;
      setProgress(null);
      if (!finished) return false;
    }
    done.current = true;
    commitApplying(s, a, label);
    return true;
  };

  return {
    refused: typeof applying === 'string' ? applying : null,
    // What it works on, for the dialog's square at 100%.
    applying: a,
    progress,
    ok,
    cancel: () => handle.current?.cancel(),
  };
}
