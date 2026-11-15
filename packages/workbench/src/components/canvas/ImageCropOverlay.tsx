'use client';

// Cropping an image on the canvas (docs/specs/009-elements/picture-crop-and-mask.md "Cropping in the editor"): the
// whole picture with what lies outside the frame dimmed, the frame and its handles, in the grips layer above every
// element, turned with the element. Drags change local state only; Done commits once.
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ImageElement } from '@livedocuments/document';
import { BoxGripsPortal } from '@liveworkspace/workbench/components/canvas/SelectionGripsLayer';
import { useCanvasZoom } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { endImageCrop } from '@/lib/image-crop-store';
import { track } from '@/lib/telemetry';
import {
  CROP_CORNERS,
  CROP_EDGES,
  cropSessionResult,
  cropSessionStart,
  cropZoom,
  dragFrame,
  fitAspect,
  localDelta,
  panPicture,
  resetCrop,
  zoomPicture,
  type CropHandle,
  type CropResult,
  type CropSession,
} from '@/lib/image-crop-math';
import { ImageCropBar, cropAspectRatio, type CropAspect } from './ImageCropBar';

// Screen px of the handles and the frame's line, whatever the zoom (D253).
const CORNER_PX = 12;
const EDGE_LONG_PX = 20;
const EDGE_SHORT_PX = 6;
const FRAME_PX = 1.5;
const VEIL = 'rgb(15 23 42 / 0.55)';

const HANDLE_CURSOR: Record<CropHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};
const HANDLE_NAME: Record<CropHandle, string> = {
  n: 'Top edge',
  s: 'Bottom edge',
  e: 'Right edge',
  w: 'Left edge',
  ne: 'Top right corner',
  nw: 'Top left corner',
  se: 'Bottom right corner',
  sw: 'Bottom left corner',
};

type Gesture = {
  kind: 'pan' | CropHandle;
  x: number;
  y: number;
  from: CropSession;
  shift: boolean;
};

export function ImageCropOverlay({
  element,
  src,
  natural,
  onApply,
}: {
  element: ImageElement;
  src: string;
  // The picture's own size; null falls back to the box's proportions.
  natural: { width: number; height: number } | null;
  onApply: (result: CropResult) => void;
}) {
  const zoom = useCanvasZoom();
  const [session, setSession] = useState<CropSession>(() => cropSessionStart(element, natural));
  const [aspect, setAspect] = useState<CropAspect>('free');
  const gesture = useRef<Gesture | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rotation = element.rotation ?? 0;
  const aspectRatio = cropAspectRatio(aspect, session.picture);

  const finish = (apply: boolean) => {
    if (apply) {
      const result = cropSessionResult(element, session);
      if (result) {
        onApply(result);
        track('Element', 'Changed', 'ImageCrop');
      }
    }
    endImageCrop();
  };
  const finishEvent = useEffectEvent(finish);
  const panBy = useEffectEvent((dx: number, dy: number) =>
    setSession((s) => panPicture(s, dx, dy)),
  );

  // Enter applies, Escape cancels, the arrows nudge the picture; a press anywhere off the picture and the bar applies.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        finishEvent(e.key === 'Enter');
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const d =
        e.key === 'ArrowLeft'
          ? [-step, 0]
          : e.key === 'ArrowRight'
            ? [step, 0]
            : e.key === 'ArrowUp'
              ? [0, -step]
              : e.key === 'ArrowDown'
                ? [0, step]
                : null;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      panBy(d[0]!, d[1]!);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (overlayRef.current?.contains(t) || barRef.current?.contains(t))) return;
      finishEvent(true);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, []);

  const begin = (kind: Gesture['kind']) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    gesture.current = { kind, x: e.clientX, y: e.clientY, from: session, shift: e.shiftKey };
  };
  const move = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    e.stopPropagation();
    const d = localDelta(e.clientX - g.x, e.clientY - g.y, zoom, rotation);
    if (g.kind === 'pan') {
      setSession(panPicture(g.from, d.dx, d.dy));
      return;
    }
    const keep =
      aspectRatio ??
      (e.shiftKey && g.kind.length === 2 ? g.from.frame.width / g.from.frame.height : null);
    setSession(dragFrame(g.from, g.kind, d.dx, d.dy, keep));
  };
  const end = (e: ReactPointerEvent) => {
    if (!gesture.current) return;
    e.stopPropagation();
    gesture.current = null;
  };

  const { frame, picture } = session;
  const corner = CORNER_PX / zoom;
  const line = FRAME_PX / zoom;
  const handles = aspectRatio ? CROP_CORNERS : [...CROP_CORNERS, ...CROP_EDGES];
  const handleBox = (h: CropHandle) => {
    const cx = h.includes('w')
      ? frame.x
      : h.includes('e')
        ? frame.x + frame.width
        : frame.x + frame.width / 2;
    const cy = h.includes('n')
      ? frame.y
      : h.includes('s')
        ? frame.y + frame.height
        : frame.y + frame.height / 2;
    const isEdge = h.length === 1;
    const w = isEdge ? (h === 'n' || h === 's' ? EDGE_LONG_PX : EDGE_SHORT_PX) / zoom : corner;
    const hh = isEdge ? (h === 'n' || h === 's' ? EDGE_SHORT_PX : EDGE_LONG_PX) / zoom : corner;
    return { left: cx - w / 2, top: cy - hh / 2, width: w, height: hh };
  };
  const picStyle = (x: number, y: number) => ({
    left: x,
    top: y,
    width: picture.width,
    height: picture.height,
    filter: element.greyscale ? 'grayscale(1)' : undefined,
  });

  return (
    <BoxGripsPortal>
      <div
        ref={overlayRef}
        role="group"
        aria-label="Crop Image"
        data-image-crop-for={element.id}
        className="absolute"
        style={{
          left: element.x,
          top: element.y,
          width: element.width,
          height: element.height,
          transform: rotation % 360 !== 0 ? `rotate(${rotation}deg)` : undefined,
          transformOrigin: 'center',
          pointerEvents: 'none',
        }}
      >
        {/* The whole picture, dimmed: a drag anywhere on it slides it under the frame. */}
        <div
          className="pointer-events-auto absolute cursor-move touch-none"
          style={{ left: picture.x, top: picture.y, width: picture.width, height: picture.height }}
          onPointerDown={begin('pan')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute block max-w-none select-none"
            style={picStyle(0, 0)}
          />
          <div className="absolute inset-0" style={{ background: VEIL }} />
        </div>
        {/* The kept part, at full strength, inside the frame. */}
        <div
          className="pointer-events-none absolute overflow-hidden"
          style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute block max-w-none select-none"
            style={picStyle(picture.x - frame.x, picture.y - frame.y)}
          />
          {/* Thirds lines. */}
          {[1, 2].map((i) => (
            <span
              key={`v${i}`}
              className="absolute top-0 bottom-0 bg-white/35"
              style={{ left: `${(i * 100) / 3}%`, width: line }}
            />
          ))}
          {[1, 2].map((i) => (
            <span
              key={`h${i}`}
              className="absolute right-0 left-0 bg-white/35"
              style={{ top: `${(i * 100) / 3}%`, height: line }}
            />
          ))}
        </div>
        {/* The frame. */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
            outline: `${line}px solid #ffffff`,
            boxShadow: `0 0 0 ${line * 2}px rgb(15 23 42 / 0.4)`,
          }}
        />
        {handles.map((h) => (
          <div
            key={h}
            data-crop-handle={h}
            data-crop-handle-name={HANDLE_NAME[h]}
            aria-hidden
            className="pointer-events-auto absolute touch-none rounded-[2px] border-brand-600 bg-white shadow-sm"
            style={{ ...handleBox(h), borderWidth: line, cursor: HANDLE_CURSOR[h] }}
            onPointerDown={begin(h)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
        ))}
      </div>
      <ImageCropBar
        barRef={barRef}
        aspect={aspect}
        zoom={cropZoom(session)}
        onAspect={(a) => {
          setAspect(a);
          const r = cropAspectRatio(a, session.picture);
          if (r) setSession((s) => fitAspect(s, r));
        }}
        onZoom={(z) => setSession((s) => zoomPicture(s, z))}
        onReset={() => {
          setAspect('free');
          setSession((s) => resetCrop(s, element));
        }}
        onCancel={() => finish(false)}
        onDone={() => finish(true)}
      />
    </BoxGripsPortal>
  );
}
