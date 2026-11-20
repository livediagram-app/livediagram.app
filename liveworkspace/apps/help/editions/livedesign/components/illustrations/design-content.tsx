// The work a livedesign page holds, drawn small for the help scenes: a phone screen wireframe, a web page
// wireframe, a logo mark and a photo. Scenes place these on DesignPage sheets (./editor-chrome) so every figure shows
// livedesign's own kind of work rather than another app's (a flowchart, a board).

import { Label, TextBar } from '@liveworkspace/help-site/art/primitives';
import { DesignPage } from './editor-chrome';

/** A phone screen wireframe, top-left at (x, y): the status notch, a title, an image block, copy and a solid
 *  call-to-action. `variant` changes the middle so a row of screens reads as a flow. */
export function PhoneScreen({
  x,
  y,
  w = 62,
  h = 124,
  variant = 'home',
  cta = 'Shop',
  frame = true,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  variant?: 'home' | 'product' | 'checkout' | 'signin';
  cta?: string;
  frame?: boolean;
}) {
  const p = 6;
  const iw = w - 2 * p;
  return (
    <g>
      {frame && (
        <>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={9}
            className="fill-white stroke-slate-700"
            strokeWidth={1.5}
          />
          <rect
            x={x + w / 2 - 8}
            y={y + 4}
            width={16}
            height={3}
            rx={1.5}
            className="fill-slate-700"
          />
        </>
      )}
      <TextBar x={x + p} y={y + 13} w={iw * 0.55} h={4} tone="muted" />
      {variant === 'home' && (
        <>
          <rect
            x={x + p}
            y={y + 22}
            width={iw}
            height={h * 0.3}
            rx={3}
            className="fill-brand-100"
          />
          <TextBar x={x + p} y={y + 28 + h * 0.3} w={iw * 0.8} h={3} tone="faint" />
          <TextBar x={x + p} y={y + 34 + h * 0.3} w={iw * 0.6} h={3} tone="faint" />
          <rect
            x={x + p}
            y={y + 42 + h * 0.3}
            width={iw / 2 - 2}
            height={h * 0.16}
            rx={2}
            className="fill-slate-100"
          />
          <rect
            x={x + w / 2 + 2}
            y={y + 42 + h * 0.3}
            width={iw / 2 - 2}
            height={h * 0.16}
            rx={2}
            className="fill-slate-100"
          />
        </>
      )}
      {variant === 'product' && (
        <>
          <rect
            x={x + p}
            y={y + 22}
            width={iw}
            height={h * 0.38}
            rx={3}
            className="fill-slate-100"
          />
          <TextBar x={x + p} y={y + 28 + h * 0.38} w={iw * 0.7} h={4} tone="muted" />
          <TextBar x={x + p} y={y + 36 + h * 0.38} w={iw * 0.9} h={3} tone="faint" />
          <TextBar x={x + p} y={y + 42 + h * 0.38} w={iw * 0.5} h={3} tone="faint" />
        </>
      )}
      {variant === 'checkout' && (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect
                x={x + p}
                y={y + 22 + i * 15}
                width={11}
                height={11}
                rx={2}
                className="fill-slate-100"
              />
              <TextBar x={x + p + 15} y={y + 24 + i * 15} w={iw * 0.5} h={3} tone="muted" />
              <TextBar x={x + p + 15} y={y + 29 + i * 15} w={iw * 0.3} h={3} tone="faint" />
            </g>
          ))}
          <line
            x1={x + p}
            y1={y + 70}
            x2={x + w - p}
            y2={y + 70}
            className="stroke-slate-200"
            strokeWidth={0.75}
          />
        </>
      )}
      {variant === 'signin' && (
        <>
          <circle cx={x + w / 2} cy={y + 32} r={8} className="fill-brand-100" />
          {[0, 1].map((i) => (
            <rect
              key={i}
              x={x + p}
              y={y + 48 + i * 14}
              width={iw}
              height={10}
              rx={2}
              className="fill-white stroke-slate-300"
              strokeWidth={0.75}
            />
          ))}
        </>
      )}
      <rect x={x + p} y={y + h - 22} width={iw} height={12} rx={3} className="fill-brand-500" />
      {w >= 56 && (
        <Label
          x={x + w / 2}
          y={y + h - 15.5}
          size={7.5}
          weight={600}
          anchor="middle"
          tone="onAccent"
        >
          {cta}
        </Label>
      )}
    </g>
  );
}

/** A web page wireframe in a browser frame, top-left at (x, y): the window dots and address bar, a nav, a hero
 *  heading with a button, and a row of three cards. */
export function BrowserScreen({
  x,
  y,
  w = 150,
  h = 100,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
}) {
  const cardW = (w - 24) / 3;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={4}
        className="fill-white stroke-slate-300"
        strokeWidth={0.75}
      />
      <path d={`M${x} ${y + 11} H${x + w}`} className="stroke-slate-200" strokeWidth={0.75} />
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={x + 6 + i * 5}
          cy={y + 5.5}
          r={1.4}
          className={['fill-rose-400', 'fill-amber-400', 'fill-emerald-400'][i]}
        />
      ))}
      <rect x={x + 24} y={y + 3} width={w * 0.4} height={5} rx={2.5} className="fill-slate-100" />
      <TextBar x={x + 8} y={y + 17} w={18} h={3} tone="muted" />
      {[0, 1, 2].map((i) => (
        <TextBar key={i} x={x + w - 52 + i * 15} y={y + 17} w={10} h={3} tone="faint" />
      ))}
      <TextBar x={x + 8} y={y + 30} w={w * 0.5} h={6} tone="muted" />
      <TextBar x={x + 8} y={y + 41} w={w * 0.36} h={3} tone="faint" />
      <rect x={x + 8} y={y + 49} width={30} height={9} rx={2.5} className="fill-brand-500" />
      <rect
        x={x + w * 0.62}
        y={y + 26}
        width={w * 0.3}
        height={32}
        rx={3}
        className="fill-brand-100"
      />
      {h >= 86 &&
        [0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={x + 8 + i * (cardW + 4)}
              y={y + 66}
              width={cardW}
              height={h - 74}
              rx={2.5}
              className="fill-slate-50 stroke-slate-200"
              strokeWidth={0.75}
            />
            <TextBar x={x + 12 + i * (cardW + 4)} y={y + 71} w={cardW * 0.6} h={3} tone="faint" />
          </g>
        ))}
    </g>
  );
}

/** A logo mark: a solid accent disc with a white ring and dot, over a wordmark bar. Centred at (cx, cy). */
export function LogoMark({
  cx,
  cy,
  r = 18,
  word = true,
}: {
  cx: number;
  cy: number;
  r?: number;
  word?: boolean;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className="fill-brand-500" />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.5}
        className="fill-none stroke-white help-art-as-drawn"
        strokeWidth={r * 0.16}
      />
      <circle cx={cx} cy={cy} r={r * 0.18} className="fill-white help-art-as-drawn" />
      {word && (
        <rect
          x={cx - r * 1.1}
          y={cy + r + 8}
          width={r * 2.2}
          height={Math.max(3, r * 0.22)}
          rx={1.5}
          className="fill-slate-700"
        />
      )}
    </g>
  );
}

/** A photo: sky, a sun and two green hills, clipped to (x, y, w, h). Drawn as is in both appearances. */
export function PhotoArt({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g className="help-art-as-drawn">
      <rect x={x} y={y} width={w} height={h} className="fill-sky-200" />
      <circle
        cx={x + w * 0.72}
        cy={y + h * 0.3}
        r={Math.min(w, h) * 0.12}
        className="fill-amber-300"
      />
      <path
        d={`M${x} ${y + h * 0.75} L${x + w * 0.3} ${y + h * 0.45} L${x + w * 0.55} ${y + h * 0.72} L${x + w * 0.75} ${y + h * 0.52} L${x + w} ${y + h * 0.78} V${y + h} H${x} Z`}
        className="fill-emerald-400"
      />
      <path
        d={`M${x} ${y + h * 0.88} Q${x + w * 0.5} ${y + h * 0.7} ${x + w} ${y + h * 0.9} V${y + h} H${x} Z`}
        className="fill-emerald-600"
      />
    </g>
  );
}

/** A page thumbnail for the Pages rail: a phone screen scaled into the box. */
export function phoneThumb(variant: 'home' | 'product' | 'checkout' | 'signin' = 'home') {
  return function Thumb({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
    return (
      <g>
        <TextBar x={x + 5} y={y + 6} w={w * 0.5} h={2.5} tone="muted" />
        <rect
          x={x + 5}
          y={y + 12}
          width={w - 10}
          height={h * 0.32}
          rx={2}
          className={variant === 'home' ? 'fill-brand-100' : 'fill-slate-100'}
        />
        <TextBar x={x + 5} y={y + 16 + h * 0.32} w={w * 0.6} h={2.5} tone="faint" />
        <TextBar x={x + 5} y={y + 21 + h * 0.32} w={w * 0.4} h={2.5} tone="faint" />
        <rect
          x={x + 5}
          y={y + h - 11}
          width={w - 10}
          height={6}
          rx={2}
          className="fill-brand-500"
        />
      </g>
    );
  };
}

/** The phone screen most mode scenes work on, its page at (x, y). */
export function ModeScreen({
  x,
  y,
  cta = 'Add to Cart',
  variant = 'product',
}: {
  x: number;
  y: number;
  cta?: string;
  variant?: 'home' | 'product' | 'checkout' | 'signin';
}) {
  return (
    <DesignPage x={x} y={y} w={96} h={166} size="iPhone · Wireframe" bare>
      <PhoneScreen x={x + 6} y={y + 6} w={84} h={154} variant={variant} cta={cta} frame={false} />
    </DesignPage>
  );
}
