'use client';

import { memo, useId, useMemo, useRef, useState } from 'react';
import { BRAND_APPS, type BrandApp } from './apps';
import {
  BRAND_DETAIL,
  BRAND_FACES,
  BRAND_GRADIENTS,
  BRAND_MARK_VIEWBOX,
  type BrandFace,
  type BrandMarkVariant,
} from './geometry';
import { prismPalette } from './prism';
import { prismFrame } from './motion';
import { useBrandShimmer } from './useBrandShimmer';
import { useBrandSpin, type BrandSpinTargets } from './useBrandSpin';

type BrandSize = 'xs' | 'sm' | 'md' | 'lg';

export type BrandProps = {
  // Whose logo: its palette, its wordmark and its colours.
  app: BrandApp;
  href?: string;
  size?: BrandSize;
  className?: string;
  // Override colour for the "live" half of the wordmark and the logo mark.
  // Used by the editor header to tint the logo with the active tab's theme
  // accent; when unset, the app's palette and its brand-700 / 400 show.
  accentColor?: string;
  // Extra classes for the wordmark span ("live" + the app's word). The editor
  // passes `hidden sm:inline` here so the wordmark drops off the mobile
  // header (the logo mark stays for orientation). The site header
  // hides it only below 360px, a 320px phone, so the bar fits.
  wordmarkClassName?: string;
};

// Type size, and the gap between the mark and the wordmark at that size. `xs` names an app inside a line of
// small text (a setting's option, a list's detail).
const sizeClasses: Record<BrandSize, string> = {
  xs: 'gap-1 text-[13px] font-semibold tracking-tight',
  sm: 'gap-2 text-base font-semibold tracking-tight',
  md: 'gap-2.5 text-lg font-semibold tracking-tight',
  lg: 'gap-3 text-2xl font-semibold tracking-tight',
};

// The cube is a solid, so it reads smaller than a line icon at the same box;
// it sits a size up from the text so it holds its own beside the wordmark.
const markClasses: Record<BrandSize, string> = {
  xs: 'size-4',
  sm: 'size-5',
  md: 'size-7',
  lg: 'size-10',
};

// The wordmark's one-off gleam: a highlight band clipped to the letters, white
// over light-mode ink, the app's 300 over dark mode's near-white (white would vanish).
const SHIMMER_CLASS =
  'pointer-events-none absolute inset-0 bg-clip-text text-transparent opacity-0 [--ldm-shine:rgba(255,255,255,0.9)]';
const SHIMMER_STYLE: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(105deg, transparent 38%, var(--ldm-shine) 50%, transparent 62%)',
  backgroundSize: '300% 100%',
  backgroundPosition: '100% 0',
};

// A logo link to the page already open scrolls back to its top instead of
// reloading (the footer's on the homepage, the header's anywhere). Modified
// clicks (new tab, new window) keep the browser's own behaviour.
function scrollTopIfHere(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return;
  const target = new URL(e.currentTarget.href, window.location.href);
  if (target.origin !== window.location.origin || target.pathname !== window.location.pathname)
    return;
  e.preventDefault();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}

const COLOUR_TRANSITION = 'color var(--transition-duration-micro) ease-out';

export function Brand({
  app,
  href,
  size = 'md',
  className = '',
  accentColor,
  wordmarkClassName = '',
}: BrandProps) {
  const { word, liveClass, shineClass } = BRAND_APPS[app];
  // Pointing at the logo (or reaching it by keyboard) opens and turns the prism.
  // Each start also counts a hover, which runs the wordmark's gleam once.
  const [spinning, setSpinning] = useState(false);
  const [hovers, setHovers] = useState(0);
  const shimmer = useRef<HTMLSpanElement>(null);
  useBrandShimmer(hovers, shimmer);
  const start = () => {
    if (spinning) return;
    setSpinning(true);
    setHovers((n) => n + 1);
  };
  const spinHandlers = {
    onPointerEnter: (e: React.PointerEvent) => e.pointerType !== 'touch' && start(),
    onPointerLeave: () => setSpinning(false),
    onFocus: (e: React.FocusEvent<HTMLElement>) =>
      e.currentTarget.matches(':focus-visible') && start(),
    onBlur: () => setSpinning(false),
  };
  const classes =
    `inline-flex items-center ${sizeClasses[size]} text-slate-900 dark:text-slate-100 ${className}`.trim();
  const content = (
    <>
      <BrandMark
        app={app}
        className={`${markClasses[size]} shrink-0`}
        accentColor={accentColor}
        spinning={spinning}
      />
      {/* A logotype: WCAG 1.4.3 sets text that is part of a logo no contrast minimum, and the
          contrast audits skip it by this mark. */}
      <span className={`relative ${wordmarkClassName}`.trim()} data-logotype="">
        <span
          className={accentColor ? '' : liveClass}
          style={
            accentColor
              ? { color: accentColor, transition: COLOUR_TRANSITION }
              : { transition: COLOUR_TRANSITION }
          }
        >
          live
        </span>
        {word}
        <span
          ref={shimmer}
          aria-hidden="true"
          className={`${SHIMMER_CLASS} ${shineClass}`}
          style={SHIMMER_STYLE}
        >
          <span>live</span>
          {word}
        </span>
      </span>
    </>
  );

  if (href) {
    return (
      // Named on the link itself: a caller may hide the wordmark (the editor header on a phone), and the
      // mark alone has no text. The name is the wordmark's own text, so a visible one still matches it.
      <a
        href={href}
        aria-label={app}
        className={classes}
        onClick={scrollTopIfHere}
        {...spinHandlers}
      >
        {content}
      </a>
    );
  }
  return (
    <span className={classes} {...spinHandlers}>
      {content}
    </span>
  );
}

// Each stop carries its light and dark colour as custom properties and picks
// one by the page's `.dark` class; a theme change crossfades the stop colours.
const STOP_CLASS =
  '[stop-color:var(--ldm-l)] dark:[stop-color:var(--ldm-d)] transition-[stop-color] duration-micro ease-out motion-reduce:transition-none';
const BLEND_CLASS = 'mix-blend-multiply dark:mix-blend-screen';
// The face layers' opacity per tone: in colour each layer shows as drawn; in
// mono a side wears the artwork's left or right face opacity.
const MONO_OPACITY = Object.fromEntries(BRAND_FACES.map((f) => [f.key, f.monoOpacity])) as Record<
  BrandFace['key'],
  number
>;
const LAYER_OPACITY = {
  colour: { left: 1, right: 1 },
  mono: { left: MONO_OPACITY.left, right: MONO_OPACITY.rearRight },
} as const;

// The resting pose: identical to the artwork's paths.
const REST = prismFrame({ turn: 0, open: 0 });

// The Living Prism (docs/specs/004-interface-design/brand-mark.md): a glass
// cube over the app's palette, or tinted from `accentColor`, following the
// page's light / dark scheme. `full` adds the inner diagram, sheen and pulse
// for 48px and up. `tone="mono"` draws it in currentColor for a solid tile.
// While `spinning`, the prism opens and turns in 3D (useBrandSpin).
export function BrandMark({
  app,
  className,
  style,
  accentColor,
  variant = 'compact',
  tone = 'colour',
  spinning = false,
}: {
  app: BrandApp;
  className?: string;
  style?: React.CSSProperties;
  accentColor?: string;
  variant?: BrandMarkVariant;
  tone?: 'colour' | 'mono';
  spinning?: boolean;
}) {
  // Gradient ids are document-global, so each instance prefixes its own.
  const uid = `ldm${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const light = useMemo(() => prismPalette(app, 'light', accentColor), [app, accentColor]);
  const dark = useMemo(() => prismPalette(app, 'dark', accentColor), [app, accentColor]);
  const targets = useRef<BrandSpinTargets>({ top: null, bottom: null, left: [], right: [] });
  const layerOpacity = LAYER_OPACITY[tone];
  useBrandSpin(spinning, targets, layerOpacity);

  const mono = tone === 'mono';
  const full = !mono && variant === 'full';
  const fill = (gradient: string) => (mono ? 'currentColor' : `url(#${uid}-${gradient})`);
  const blend = mono ? undefined : BLEND_CLASS;
  const { nodes, sheen, pulse } = BRAND_DETAIL;
  return (
    <svg
      viewBox={BRAND_MARK_VIEWBOX}
      className={`isolate overflow-visible ${className ?? ''}`.trim()}
      style={style}
      aria-hidden="true"
    >
      {!mono && (
        <defs>
          {BRAND_GRADIENTS.map(({ key, vector: v, stops }) => (
            <linearGradient
              key={key}
              id={`${uid}-${key}`}
              x1={`${v.x1}%`}
              y1={`${v.y1}%`}
              x2={`${v.x2}%`}
              y2={`${v.y2}%`}
            >
              {stops.map(([stop, offset, opacity]) => (
                <stop
                  key={offset}
                  offset={`${offset}%`}
                  stopOpacity={opacity}
                  className={STOP_CLASS}
                  style={{ '--ldm-l': light[stop], '--ldm-d': dark[stop] } as React.CSSProperties}
                />
              ))}
            </linearGradient>
          ))}
          {full && (
            <>
              <linearGradient id={`${uid}-sheen`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0.05} />
              </linearGradient>
              <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </>
          )}
        </defs>
      )}
      {/* Back to front, as the artwork: the lid, every side's right-lit layer,
          the inner diagram, every side's left-lit layer, the bottom fold. */}
      <path
        ref={(el) => {
          targets.current.top = el;
        }}
        d={REST.top}
        fill={fill('backTop')}
        opacity={mono ? MONO_OPACITY.top : undefined}
      />
      {REST.sides.map((side, i) => (
        <path
          key={`r${i}`}
          ref={(el) => {
            targets.current.right[i] = el;
          }}
          d={side.d}
          fill={fill('backRight')}
          opacity={side.right * layerOpacity.right}
          className={blend}
        />
      ))}
      {full && (
        <g
          opacity={nodes.opacity}
          className="[--ldm-n:var(--ldm-nl)] dark:[--ldm-n:var(--ldm-nd)]"
          style={{ '--ldm-nl': light.highlight, '--ldm-nd': dark.highlight } as React.CSSProperties}
        >
          <path
            d={nodes.link}
            fill="none"
            style={{ stroke: 'var(--ldm-n)' }}
            strokeWidth={2.5}
            strokeDasharray="4 4"
          />
          {nodes.circles.map((c) => (
            <circle
              key={c.cx}
              {...c}
              style={{ fill: 'var(--ldm-n)' }}
              filter={`url(#${uid}-glow)`}
            />
          ))}
        </g>
      )}
      {REST.sides.map((side, i) => (
        <path
          key={`l${i}`}
          ref={(el) => {
            targets.current.left[i] = el;
          }}
          d={side.d}
          fill={fill('frontLeft')}
          opacity={side.left * layerOpacity.left}
        />
      ))}
      <path
        ref={(el) => {
          targets.current.bottom = el;
        }}
        d={REST.bottom}
        fill={fill('frontBottom')}
        opacity={mono ? MONO_OPACITY.bottom : undefined}
        className={blend}
      />
      {full &&
        sheen.map((s) => (
          <path
            key={s.d}
            d={s.d}
            stroke={`url(#${uid}-sheen)`}
            strokeWidth={s.width}
            strokeLinecap="round"
            fill="none"
            opacity={s.opacity}
          />
        ))}
      {full &&
        pulse.map((p) => (
          <circle
            key={p.cx}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill="#ffffff"
            opacity={p.opacity}
            filter={p.glow ? `url(#${uid}-glow)` : undefined}
          />
        ))}
    </svg>
  );
}

// The prism at rest in one colour (currentColor) with each face at its mono
// opacity, so the fold still shows: the compact mark for a list's every row. Its
// faces are worked out once, hidden sides left out, and it keeps no state and
// draws no gradients, so a long list pays for four paths a row.
const GLYPH_FACES: readonly { d: string; opacity: number }[] = [
  { d: REST.top, opacity: MONO_OPACITY.top },
  ...REST.sides.map((side) => ({ d: side.d, opacity: side.right * LAYER_OPACITY.mono.right })),
  ...REST.sides.map((side) => ({ d: side.d, opacity: side.left * LAYER_OPACITY.mono.left })),
  { d: REST.bottom, opacity: MONO_OPACITY.bottom },
].filter((face) => face.opacity > 0);
const GLYPH_PATHS = GLYPH_FACES.map((face, i) => (
  <path key={i} d={face.d} opacity={face.opacity} />
));

export const BrandGlyph = memo(function BrandGlyph({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox={BRAND_MARK_VIEWBOX}
      className={className}
      style={style}
      aria-hidden="true"
      fill="currentColor"
    >
      {GLYPH_PATHS}
    </svg>
  );
});
