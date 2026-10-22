'use client';

// What a photo tool shows over the photo while it works (docs/specs/031-photo/photo-tools.md): the
// selection's marching ants, a marquee or lasso being drawn, a gradient's line, the crop box with its
// thirds and the cropped-away part dimmed, floating pixels on their way (with the transform box), the
// Clone Stamp's source, a shape being drawn and the Eyedropper's ring. Drawn in the photo's own px over
// its page; strokes keep one screen width at any zoom.
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  boxCorners,
  boxFromReadout,
  chain,
  IDENTITY,
  maskOutline,
  translate,
  type Mask8,
  type Matrix,
  type Raster,
} from '@livedesign/photo-engine';
import type { OverlayStore } from '@/hooks/editor/usePhotoEditor';
import type { ToolOverlay } from '@/lib/photo-editor/tools/tool-context';

type Size = { width: number; height: number };

/** The selection's edge as an SVG path, in photo px. */
export function antsPath(m: Mask8 | null): string {
  if (!m) return '';
  return maskOutline(m)
    .map((loop) => `M${loop.map((p) => `${p.x} ${p.y}`).join('L')}Z`)
    .join('');
}

const LINE = { vectorEffect: 'non-scaling-stroke' as const, fill: 'none' };

/** A black-and-white line pair: it meets 3:1 on any pixels. */
function Pair({ d, walking = false }: { d: string; walking?: boolean }) {
  return (
    <>
      <path d={d} {...LINE} stroke="#fff" strokeWidth={1} />
      <path
        d={d}
        {...LINE}
        stroke="#000"
        strokeWidth={1}
        strokeDasharray="4 4"
        className={walking ? 'photo-ants' : undefined}
      />
    </>
  );
}

function FloatingPixels({
  raster,
  x,
  y,
  matrix,
  photo,
  page,
}: {
  raster: Raster;
  x: number;
  y: number;
  matrix?: Matrix;
  photo: Size;
  page: Size;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = raster.width;
    c.height = raster.height;
    c.getContext('2d')?.putImageData(
      new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height),
      0,
      0,
    );
  }, [raster]);
  // Photo px to page px, after the lift's place and the transform.
  const m = chain(translate(x, y), matrix ?? IDENTITY);
  const sx = page.width / photo.width;
  const sy = page.height / photo.height;
  // A CSS matrix3d (column-major) of the 3 x 3 homography, scaled onto the page.
  const css = `matrix3d(${m[0] * sx},${m[3] * sy},0,${m[6]},${m[1] * sx},${m[4] * sy},0,${m[7]},0,0,1,0,${m[2] * sx},${m[5] * sy},0,${m[8]})`;
  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute left-0 top-0"
      style={{ transform: css, transformOrigin: '0 0', imageRendering: 'auto' }}
    />
  );
}

function Shapes({ o, photo }: { o: ToolOverlay; photo: Size }) {
  switch (o.kind) {
    case 'rect':
      return o.ellipse ? (
        <ellipse
          cx={o.x + o.width / 2}
          cy={o.y + o.height / 2}
          rx={o.width / 2}
          ry={o.height / 2}
          {...LINE}
          stroke="#000"
          strokeDasharray="4 4"
        />
      ) : (
        <Pair d={`M${o.x} ${o.y}h${o.width}v${o.height}h${-o.width}Z`} />
      );
    case 'path':
      return o.points.length ? (
        <Pair
          d={`M${[...o.points, ...(o.live ? [o.live] : [])].map((p) => `${p.x} ${p.y}`).join('L')}${o.closed ? 'Z' : ''}`}
        />
      ) : null;
    case 'line':
    case 'shape':
      if (o.kind === 'shape' && o.shape !== 'line') {
        const x = Math.min(o.from.x, o.to.x);
        const y = Math.min(o.from.y, o.to.y);
        const w = Math.abs(o.to.x - o.from.x);
        const h = Math.abs(o.to.y - o.from.y);
        return o.shape === 'ellipse' ? (
          <ellipse
            cx={x + w / 2}
            cy={y + h / 2}
            rx={w / 2}
            ry={h / 2}
            {...LINE}
            stroke="#000"
            strokeDasharray="4 4"
          />
        ) : (
          <Pair d={`M${x} ${y}h${w}v${h}h${-w}Z`} />
        );
      }
      return <Pair d={`M${o.from.x} ${o.from.y}L${o.to.x} ${o.to.y}`} />;
    case 'crop': {
      const corners = boxCorners(boxFromReadout(100, 100, o), 100, 100);
      const box = `M${corners.map((p) => `${p.x} ${p.y}`).join('L')}Z`;
      const at = (u: number, v: number) => {
        const [a, b, , d] = corners;
        return {
          x: a!.x + (b!.x - a!.x) * u + (d!.x - a!.x) * v,
          y: a!.y + (b!.y - a!.y) * u + (d!.y - a!.y) * v,
        };
      };
      const thirds = [1 / 3, 2 / 3]
        .flatMap((t) => [
          [at(t, 0), at(t, 1)],
          [at(0, t), at(1, t)],
        ])
        .map(([p, q]) => `M${p!.x} ${p!.y}L${q!.x} ${q!.y}`)
        .join('');
      return (
        <>
          {/* The part cropped away, dimmed. */}
          <path
            d={`M0 0H${photo.width}V${photo.height}H0Z${box}`}
            fill="rgb(0 0 0 / 0.45)"
            fillRule="evenodd"
          />
          <path d={thirds} {...LINE} stroke="rgb(255 255 255 / 0.6)" />
          <Pair d={box} />
        </>
      );
    }
    case 'source':
      return <Pair d={`M${o.x - 8} ${o.y}h16M${o.x} ${o.y - 8}v16`} />;
    default:
      return null;
  }
}

/** The transform box round floating pixels: its edges and eight handles. */
function TransformBox({ o, perPx }: { o: Extract<ToolOverlay, { kind: 'float' }>; perPx: number }) {
  const m = chain(translate(o.x, o.y), o.matrix ?? IDENTITY);
  const c = boxCorners(m, o.raster.width, o.raster.height);
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const handles = [
    c[0]!,
    mid(c[0]!, c[1]!),
    c[1]!,
    mid(c[1]!, c[2]!),
    c[2]!,
    mid(c[2]!, c[3]!),
    c[3]!,
    mid(c[3]!, c[0]!),
  ];
  const r = 4 / perPx;
  return (
    <>
      <Pair d={`M${c.map((p) => `${p.x} ${p.y}`).join('L')}Z`} />
      {handles.map((h, i) => (
        <rect
          key={i}
          x={h.x - r}
          y={h.y - r}
          width={r * 2}
          height={r * 2}
          fill="#fff"
          stroke="#000"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );
}

export function PhotoToolOverlay({
  store,
  selection,
  photo,
  page,
  perPx,
  showBox,
}: {
  store: OverlayStore;
  selection: Mask8 | null;
  photo: Size;
  page: Size;
  // Screen px a photo px.
  perPx: number;
  // A Free Transform's box shows round floating pixels.
  showBox: boolean;
}) {
  const o = useSyncExternalStore(store.subscribe, store.get, store.get);
  const ants = useMemo(() => antsPath(selection), [selection]);
  return (
    <>
      {o.kind === 'float' ? (
        <FloatingPixels
          raster={o.raster}
          x={o.x}
          y={o.y}
          matrix={o.matrix}
          photo={photo}
          page={page}
        />
      ) : null}
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={page.width}
        height={page.height}
        viewBox={`0 0 ${photo.width} ${photo.height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {ants ? <Pair d={ants} walking /> : null}
        <Shapes o={o} photo={photo} />
        {o.kind === 'float' && showBox ? <TransformBox o={o} perPx={perPx} /> : null}
      </svg>
      {o.kind === 'ring' ? (
        <div
          className="pointer-events-none absolute rounded-full border-2 border-white shadow-[0_0_0_1px_#000]"
          style={{
            left: (o.x / photo.width) * page.width,
            top: (o.y / photo.height) * page.height,
            // 64 screen px across, whatever the zoom.
            width: (64 * page.width) / photo.width / perPx,
            height: (64 * page.width) / photo.width / perPx,
            transform: 'translate(-50%, -50%)',
            background: `linear-gradient(${o.colour} 50%, ${o.was} 50%)`,
          }}
        />
      ) : null}
    </>
  );
}
