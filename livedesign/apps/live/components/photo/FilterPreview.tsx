'use client';

// A filter dialog's own views (docs/specs/031-photo/photo-adjustments.md "Filters"): the square at 100%, the
// filter worked on its photo px from the pixels before, dragged to look around; and, for a filter with a
// centre (Radial Blur, Lens Flare, Pinch, ...), the photo small with the centre on it, placed by a press.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PREVIEW_CHECKER } from '@/components/dialogs/ImageExportPanel';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { filterSquare, type Applying } from '@/lib/photo-editor/apply-ops';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { PREVIEW_DEBOUNCE_MS } from './useApplyPreview';
import { usePhotoPreviewUrl } from './usePhotoPreviewUrl';

// The square's side, CSS px: a photo px each.
export const FILTER_SQUARE_PX = 160;

/** The square's photo px for a centre, kept within the photo. */
export function squareAt(
  centre: { x: number; y: number },
  photo: { width: number; height: number },
  side = FILTER_SQUARE_PX,
) {
  const width = Math.min(side, photo.width);
  const height = Math.min(side, photo.height);
  return {
    x: Math.round(Math.min(Math.max(0, centre.x - width / 2), photo.width - width)),
    y: Math.round(Math.min(Math.max(0, centre.y - height / 2), photo.height - height)),
    width,
    height,
  };
}

export function FilterPreviewSquare({
  photo,
  applying,
  id,
  params,
}: {
  photo: PhotoEditorView;
  applying: Applying;
  id: string;
  params: Record<string, unknown>;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const size = { width: s.photo.width, height: s.photo.height };
  const [centre, setCentre] = useState(() => ({
    x: applying.area.x + applying.area.width / 2,
    y: applying.area.y + applying.area.height / 2,
  }));
  const [working, setWorking] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const rect = squareAt(centre, size);
  const key = JSON.stringify([rect, params]);
  useEffect(() => {
    let live = true;
    let cancel: (() => void) | null = null;
    const t = setTimeout(() => {
      setWorking(true);
      const run = filterSquare(s, applying, id, params, photoTools.get(), rect);
      cancel = run.cancel;
      void run.done.then((r) => {
        if (!live) return;
        setWorking(false);
        const ctx = canvasRef.current?.getContext('2d');
        if (!r || !ctx) return;
        ctx.clearRect(0, 0, FILTER_SQUARE_PX, FILTER_SQUARE_PX);
        ctx.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0);
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(t);
      cancel?.();
    };
    // The square's place and the settings are its inputs, in `key`.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [key, s, applying, id]);
  const down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const from = drag.current;
    if (!from) return;
    drag.current = { x: e.clientX, y: e.clientY };
    // A photo px a CSS px: the square looks the other way to the drag.
    setCentre((c) => ({ x: c.x - (e.clientX - from.x), y: c.y - (e.clientY - from.y) }));
  };
  return (
    <div className="flex flex-col items-start gap-1">
      <canvas
        ref={canvasRef}
        width={FILTER_SQUARE_PX}
        height={FILTER_SQUARE_PX}
        role="img"
        aria-label="Preview at 100%: drag to look around"
        aria-busy={working}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => {
          drag.current = null;
        }}
        className="cursor-grab touch-none rounded border border-slate-200 active:cursor-grabbing dark:border-slate-700"
        style={{ width: FILTER_SQUARE_PX, height: FILTER_SQUARE_PX, background: PREVIEW_CHECKER }}
      />
      <span className="text-[10px] text-slate-500 dark:text-slate-400">
        100% · drag to look around
      </span>
    </div>
  );
}

// The point picker's width, CSS px.
const PICKER_WIDTH = 200;

export function FilterPointPicker({
  photo,
  name,
  value,
  onChange,
}: {
  photo: PhotoEditorView;
  name: string;
  value: { x: number; y: number };
  onChange: (p: { x: number; y: number }) => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const url = usePhotoPreviewUrl(photo.scope, photo.tabId, s.photo.preview, (id) =>
    photo.store?.ownBlob(id),
  );
  const height = Math.round((PICKER_WIDTH * s.photo.height) / s.photo.width);
  const place = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    onChange({
      x: Math.round(clamp((e.clientX - r.left) / r.width) * 100) / 100,
      y: Math.round(clamp((e.clientY - r.top) / r.height) * 100) / 100,
    });
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`${name}: press the photo to place it`}
      aria-valuetext={`${Math.round(value.x * 100)}% across, ${Math.round(value.y * 100)}% down`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        place(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons) place(e);
      }}
      onKeyDown={(e) => {
        const d =
          e.key === 'ArrowLeft'
            ? [-0.01, 0]
            : e.key === 'ArrowRight'
              ? [0.01, 0]
              : e.key === 'ArrowUp'
                ? [0, -0.01]
                : e.key === 'ArrowDown'
                  ? [0, 0.01]
                  : null;
        if (!d) return;
        e.preventDefault();
        const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
        onChange({ x: clamp(value.x + d[0]!), y: clamp(value.y + d[1]!) });
      }}
      className="relative cursor-crosshair touch-none overflow-hidden rounded border border-slate-200 dark:border-slate-700"
      style={{ width: PICKER_WIDTH, height, background: PREVIEW_CHECKER }}
    >
      {url ? (
        <img src={url} alt="" className="pointer-events-none h-full w-full" draggable={false} />
      ) : null}
      <span
        aria-hidden
        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0_/_0.8)]"
        style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
      />
    </div>
  );
}
