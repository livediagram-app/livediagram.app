import { Fragment, useId, useMemo } from 'react';
import {
  BRAND_DETAIL,
  BRAND_FACES,
  BRAND_GRADIENTS,
  BRAND_MARK_VIEWBOX,
  type BrandFace,
  type BrandMarkVariant,
} from './brand-mark-geometry';
import { prismPalette } from './brand-prism';

type BrandSize = 'sm' | 'md';

type BrandProps = {
  href?: string;
  size?: BrandSize;
  className?: string;
  // Override colour for the "live" half of the wordmark and the logo mark.
  // Used by the editor header to tint the logo with the active tab's theme
  // accent; when unset, the brand palette and brand-600 / sky-400 show.
  accentColor?: string;
  // Extra classes for the wordmark span ("live" + "diagram"). The editor
  // passes `hidden sm:inline` here so the wordmark drops off the mobile
  // header (the logo mark stays for orientation). Marketing surfaces leave
  // this unset so the wordmark always shows.
  wordmarkClassName?: string;
};

const sizeClasses: Record<BrandSize, string> = {
  sm: 'text-base font-semibold tracking-tight',
  md: 'text-lg font-semibold tracking-tight',
};

// The cube is a solid, so it reads smaller than a line icon at the same box;
// it sits a size up from the text so it holds its own beside the wordmark.
const markClasses: Record<BrandSize, string> = {
  sm: 'size-5',
  md: 'size-7',
};

const COLOUR_TRANSITION = 'color var(--transition-duration-micro) ease-out';

export function Brand({
  href,
  size = 'md',
  className = '',
  accentColor,
  wordmarkClassName = '',
}: BrandProps) {
  const classes =
    `group inline-flex items-center gap-2 ${sizeClasses[size]} text-slate-900 dark:text-slate-100 ${className}`.trim();
  const content = (
    <>
      <BrandMark className={`${markClasses[size]} shrink-0`} accentColor={accentColor} />
      {/* A logotype: WCAG 1.4.3 sets text that is part of a logo no contrast minimum, and the
          contrast audits skip it by this mark. */}
      <span className={wordmarkClassName} data-logotype="">
        <span
          className={accentColor ? '' : 'text-brand-600 dark:text-sky-400'}
          style={
            accentColor
              ? { color: accentColor, transition: COLOUR_TRANSITION }
              : { transition: COLOUR_TRANSITION }
          }
        >
          live
        </span>
        diagram
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes}>
        {content}
      </a>
    );
  }
  return <span className={classes}>{content}</span>;
}

// Each stop carries its light and dark colour as custom properties and picks
// one by the page's `.dark` class; a theme change crossfades the stop colours.
const STOP_CLASS =
  '[stop-color:var(--ldm-l)] dark:[stop-color:var(--ldm-d)] transition-[stop-color] duration-micro ease-out motion-reduce:transition-none';
const BLEND_CLASS = 'mix-blend-multiply dark:mix-blend-screen';
// Hovering or focusing a linked logo opens the prism: the faces drift apart
// along the cube's own axes (the lid up, the sides out on the 30 degree
// isometric diagonals, the bottom fold down), so the glass layers separate and
// their blended overlaps shift, then settle back. Transform only, so it stays
// on the compositor; reduced motion holds the cube still.
const FACE_MOTION = 'transition-transform duration-micro ease-out motion-reduce:transition-none';
const FACE_HOVER: Record<BrandFace['key'], string> = {
  top: `${FACE_MOTION} group-hover:[transform:translateY(-16px)] group-focus-visible:[transform:translateY(-16px)]`,
  rearRight: `${FACE_MOTION} group-hover:[transform:translate(9px,5px)] group-focus-visible:[transform:translate(9px,5px)]`,
  left: `${FACE_MOTION} group-hover:[transform:translate(-9px,5px)] group-focus-visible:[transform:translate(-9px,5px)]`,
  bottom: `${FACE_MOTION} group-hover:[transform:translateY(10px)] group-focus-visible:[transform:translateY(10px)]`,
};

// The Living Prism (docs/specs/004-interface-design/brand-mark.md): a glass
// cube over the brand palette, or tinted from `accentColor`, following the
// page's light / dark scheme. `full` adds the inner diagram, sheen and pulse
// for 48px and up. `tone="mono"` draws it in currentColor for a solid tile.
export function BrandMark({
  className,
  style,
  accentColor,
  variant = 'compact',
  tone = 'colour',
}: {
  className?: string;
  style?: React.CSSProperties;
  accentColor?: string;
  variant?: BrandMarkVariant;
  tone?: 'colour' | 'mono';
}) {
  // Gradient ids are document-global, so each instance prefixes its own.
  const uid = `ldm${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const light = useMemo(() => prismPalette('light', accentColor), [accentColor]);
  const dark = useMemo(() => prismPalette('dark', accentColor), [accentColor]);

  if (tone === 'mono') {
    return (
      <svg
        viewBox={BRAND_MARK_VIEWBOX}
        className={`overflow-visible ${className ?? ''}`.trim()}
        style={style}
        aria-hidden="true"
      >
        {BRAND_FACES.map((face) => (
          <path
            key={face.key}
            d={face.d}
            fill="currentColor"
            opacity={face.monoOpacity}
            className={FACE_HOVER[face.key]}
          />
        ))}
      </svg>
    );
  }

  const full = variant === 'full';
  const { nodes, sheen, pulse } = BRAND_DETAIL;
  return (
    <svg
      viewBox={BRAND_MARK_VIEWBOX}
      className={`isolate overflow-visible ${className ?? ''}`.trim()}
      style={style}
      aria-hidden="true"
    >
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
      {BRAND_FACES.map((face, i) => (
        <Fragment key={face.key}>
          <path
            d={face.d}
            fill={`url(#${uid}-${face.gradient})`}
            className={face.blend ? `${FACE_HOVER[face.key]} ${BLEND_CLASS}` : FACE_HOVER[face.key]}
          />
          {full && i === 1 && (
            <g
              opacity={nodes.opacity}
              className="[--ldm-n:var(--ldm-nl)] dark:[--ldm-n:var(--ldm-nd)]"
              style={
                { '--ldm-nl': light.highlight, '--ldm-nd': dark.highlight } as React.CSSProperties
              }
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
        </Fragment>
      ))}
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
