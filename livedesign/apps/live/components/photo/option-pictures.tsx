'use client';

// Each choice in a tool's option popovers drawn as what it does (docs/specs/031-photo/photo-pages.md "The options
// flyout"), for its tile: a selection mode as the two shapes it combines, a blend mode by the engine's own maths
// (blend-swatch), a gradient style as itself, a crop ratio as its shape, a font in its face. A choice with no drawing
// has none, and its tile shows its name alone.
import type { ReactNode } from 'react';
import { FONTS } from '@livedesign/design';
import type { BlendMode } from '@livedesign/photo-engine';
import {
  lucideImage,
  lucideProportions,
  lucideScaling,
  lucideTextAlignCenter,
  lucideTextAlignEnd,
  lucideTextAlignStart,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import { blendSwatch, SWATCH_H, SWATCH_W } from '@/lib/photo-editor/blend-swatch';

const AlignStart = lucideGlyph(lucideTextAlignStart, 18);
const AlignCentre = lucideGlyph(lucideTextAlignCenter, 18);
const AlignEnd = lucideGlyph(lucideTextAlignEnd, 18);
const Proportions = lucideGlyph(lucideProportions, 18);
const Scaling = lucideGlyph(lucideScaling, 18);
const Picture = lucideGlyph(lucideImage, 18);

// The pictures' strokes and fills, in both themes.
const INK = 'stroke-slate-500 dark:stroke-slate-400';
const FILL = 'fill-brand-500/80 dark:fill-brand-400/80';

// A gradient style drawn as itself.
const GRADIENT_PREVIEW: Record<string, string> = {
  linear: 'linear-gradient(90deg, #1e293b, #f8fafc)',
  radial: 'radial-gradient(circle, #1e293b, #f8fafc 70%)',
  angle: 'conic-gradient(#1e293b, #f8fafc)',
  reflected: 'linear-gradient(90deg, #f8fafc, #1e293b, #f8fafc)',
  diamond: 'radial-gradient(circle, #1e293b, #f8fafc 72%)',
};

/** The two shapes a selection mode combines, what it keeps filled. */
function SelectionPicture({ mode }: { mode: string }) {
  const id = `sel-${mode}`;
  return (
    <svg viewBox="0 0 32 24" width="32" height="24" aria-hidden>
      <defs>
        <clipPath id={`${id}-a`}>
          <rect x="3" y="3" width="16" height="16" rx="2" />
        </clipPath>
        <mask id={`${id}-m`}>
          <rect width="32" height="24" fill="white" />
          <rect x="13" y="5" width="16" height="16" rx="2" fill="black" />
        </mask>
      </defs>
      {mode === 'new' ? <rect x="13" y="5" width="16" height="16" rx="2" className={FILL} /> : null}
      {mode === 'add' ? (
        <>
          <rect x="3" y="3" width="16" height="16" rx="2" className={FILL} />
          <rect x="13" y="5" width="16" height="16" rx="2" className={FILL} />
        </>
      ) : null}
      {mode === 'subtract' ? (
        <rect x="3" y="3" width="16" height="16" rx="2" mask={`url(#${id}-m)`} className={FILL} />
      ) : null}
      {mode === 'intersect' ? (
        <rect
          x="13"
          y="5"
          width="16"
          height="16"
          rx="2"
          clipPath={`url(#${id}-a)`}
          className={FILL}
        />
      ) : null}
      <rect
        x="3"
        y="3"
        width="16"
        height="16"
        rx="2"
        fill="none"
        strokeDasharray="2 1.5"
        className={INK}
      />
      <rect
        x="13"
        y="5"
        width="16"
        height="16"
        rx="2"
        fill="none"
        strokeDasharray="2 1.5"
        className={INK}
      />
    </svg>
  );
}

/** A crop ratio as a box of its shape. */
function RatioPicture({ ratio }: { ratio: string }) {
  if (ratio === 'original') return <Picture />;
  const [w, h] = ratio === 'free' ? [22, 14] : ratio.split(':').map(Number);
  const k = 20 / Math.max(w!, h!);
  const bw = w! * k;
  const bh = h! * k;
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <rect
        x={12 - bw / 2}
        y={12 - bh / 2}
        width={bw}
        height={bh}
        rx="1.5"
        fill="none"
        strokeWidth="1.5"
        strokeDasharray={ratio === 'free' ? '3 2' : undefined}
        className={INK}
      />
    </svg>
  );
}

/** The pixels a sample size averages, as a grid of dots. */
function SamplePicture({ n }: { n: number }) {
  const cells = Math.min(n, 7);
  const step = 20 / cells;
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      {Array.from({ length: cells * cells }, (_, i) => (
        <rect
          key={i}
          x={2 + (i % cells) * step + step * 0.15}
          y={2 + Math.floor(i / cells) * step + step * 0.15}
          width={step * 0.7}
          height={step * 0.7}
          rx={step * 0.2}
          className={FILL}
        />
      ))}
    </svg>
  );
}

/** What pen pressure changes, as a stroke that swells or fades along its length. */
function PressurePicture({ what }: { what: string }) {
  const id = `press-${what}`;
  const sized = what === 'size' || what === 'both';
  const faded = what === 'opacity' || what === 'both';
  return (
    <svg viewBox="0 0 32 24" width="32" height="24" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopOpacity={faded ? 0.15 : 1} stopColor="currentColor" />
          <stop offset="1" stopOpacity="1" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <path
        d={sized ? 'M3 12 Q16 10 29 7 L29 17 Q16 14 3 12 Z' : 'M3 10.5 L29 10.5 L29 13.5 L3 13.5 Z'}
        fill={`url(#${id})`}
        className="text-brand-700 dark:text-brand-300"
      />
    </svg>
  );
}

/** An eraser's tip. */
function TipPicture({ tip }: { tip: string }) {
  if (tip === 'block')
    return (
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
        <rect x="5" y="5" width="14" height="14" className={FILL} />
      </svg>
    );
  return (
    <span
      aria-hidden
      className="block h-5 w-5 rounded-full"
      style={{
        background:
          tip === 'brush'
            ? 'radial-gradient(circle, rgb(14 116 144) 35%, rgb(14 116 144 / 0) 72%)'
            : 'rgb(14 116 144)',
      }}
    />
  );
}

/** A tone range, as a ramp with its third lit. */
function RangePicture({ range }: { range: string }) {
  const at = range === 'shadows' ? 0 : range === 'midtones' ? 1 : 2;
  return (
    <span
      aria-hidden
      className="relative block h-3 w-8 overflow-hidden rounded-sm ring-1 ring-slate-300 dark:ring-slate-600"
      style={{ background: 'linear-gradient(90deg, #0f172a, #f8fafc)' }}
    >
      <span
        className="absolute inset-y-0 w-1/3 ring-2 ring-inset ring-brand-500"
        style={{ left: `${(at * 100) / 3}%` }}
      />
    </span>
  );
}

/** A transform mode, as the box it lets you make. */
function TransformPicture({ mode }: { mode: string }) {
  const d =
    mode === 'skew'
      ? 'M8 5 L22 5 L16 19 L2 19 Z'
      : mode === 'perspective'
        ? 'M8 5 L16 5 L22 19 L2 19 Z'
        : 'M12 3 L21 12 L12 21 L3 12 Z';
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <path d={d} strokeWidth="1.5" fill="none" className={INK} />
    </svg>
  );
}

/** An interpolation, as the edge it leaves on a curve. */
function InterpolationPicture({ how }: { how: string }) {
  return how === 'nearest' ? (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <path d="M3 21 V15 H9 V9 H15 V3 H21" strokeWidth="2" fill="none" className={INK} />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <path
        d="M3 21 Q 21 21 21 3"
        strokeWidth={how === 'bicubic' ? 2 : 2.6}
        fill="none"
        className={INK}
      />
    </svg>
  );
}

const fontStack = (id: string) => FONTS.find((f) => f.id === id)?.stack;

/** The picture for choice `value` of the option `key`, or null when it has none. */
export function choicePicture(key: string, value: string | number): ReactNode {
  const v = String(value);
  switch (key) {
    case 'selection':
      return <SelectionPicture mode={v} />;
    case 'mode': {
      const url = blendSwatch(v as BlendMode);
      return url ? (
        <img
          src={url}
          alt=""
          width={SWATCH_W}
          height={SWATCH_H}
          className="block h-full w-full rounded-md object-cover"
          style={{
            backgroundImage: 'repeating-conic-gradient(#e2e8f0 0 25%, #fff 0 50%)',
            backgroundSize: '8px 8px',
          }}
        />
      ) : null;
    }
    case 'gradientStyle':
      return (
        <span
          aria-hidden
          className="block h-full w-full rounded-md"
          style={{
            background: GRADIENT_PREVIEW[v],
            clipPath: v === 'diamond' ? 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' : undefined,
          }}
        />
      );
    case 'style':
      return v === 'ratio' ? (
        <Proportions />
      ) : v === 'size' ? (
        <Scaling />
      ) : (
        <RatioPicture ratio="free" />
      );
    case 'ratio':
      return <RatioPicture ratio={v} />;
    case 'sample':
      return <SamplePicture n={Number(v)} />;
    case 'pressure':
      return <PressurePicture what={v} />;
    case 'eraserMode':
      return <TipPicture tip={v} />;
    case 'range':
      return <RangePicture range={v} />;
    case 'transformMode':
      return <TransformPicture mode={v} />;
    case 'interpolation':
      return <InterpolationPicture how={v} />;
    case 'align':
      return v === 'left' ? <AlignStart /> : v === 'centre' ? <AlignCentre /> : <AlignEnd />;
    case 'weight':
      return (
        <span aria-hidden className="text-[17px] leading-none" style={{ fontWeight: Number(v) }}>
          Aa
        </span>
      );
    case 'font':
      return (
        <span aria-hidden className="text-[17px] leading-none" style={{ fontFamily: fontStack(v) }}>
          Aa
        </span>
      );
    default:
      return null;
  }
}

/** Whether a choice's picture fills its tile edge to edge (a swatch) rather than sitting in an icon plate. */
export const pictureFills = (key: string, value: string | number): boolean =>
  key === 'mode' || (key === 'gradientStyle' && String(value) in GRADIENT_PREVIEW);
