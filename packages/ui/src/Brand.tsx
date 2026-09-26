type BrandSize = 'sm' | 'md';

type BrandProps = {
  href?: string;
  size?: BrandSize;
  className?: string;
  // Override colour for the "diagram" half of the wordmark and the logo
  // mark. Used by the editor header to tint the logo with the active tab's
  // theme accent — when unset, falls back to the brand-500 utility.
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

const BRAND_500 = '#0ea5e9';

export function Brand({
  href,
  size = 'md',
  className = '',
  accentColor,
  wordmarkClassName = '',
}: BrandProps) {
  const classes =
    `group inline-flex items-center gap-1.5 ${sizeClasses[size]} text-slate-900 dark:text-slate-100 ${className}`.trim();
  const accentStyle: React.CSSProperties = accentColor
    ? { color: accentColor, transition: 'color 200ms ease-out' }
    : { transition: 'color 200ms ease-out' };
  const content = (
    <>
      <BrandMark
        className={`${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} shrink-0`}
        style={{ color: accentColor ?? BRAND_500, transition: 'color 200ms ease-out' }}
      />
      <span className={wordmarkClassName}>
        live
        <span className={accentColor ? '' : 'text-brand-500'} style={accentStyle}>
          diagram
        </span>
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

// The mark's geometry on its 24x24 viewBox, shared by the React <BrandMark>
// below and by raster renders that need it as an SVG string (marketing's
// app/apple-icon.tsx). The app/icon.svg favicons carry the same shapes as a
// static file per app, since Next's file convention needs one in each.
export const BRAND_MARK = {
  // The rotational sync arc: two thin strokes at 30% opacity.
  arcs: ['M16.8 3.8 A9.5 9.5 0 0 1 16.8 20.2', 'M7.2 20.2 A9.5 9.5 0 0 1 7.2 3.8'],
  // The link between the two nodes.
  link: 'M15 11.6 C15 14.4 10.2 11.4 10 14.2',
  circle: { cx: 15.2, cy: 9, r: 2.9 },
  square: { x: 6.6, y: 12.4, size: 5.8, rx: 1.9 },
} as const;

// The mark as a standalone SVG document in one flat colour, for renderers that
// take markup rather than React (next/og's resvg pass via a data URI).
export function brandMarkSvg(color: string = BRAND_500): string {
  const { arcs, link, circle, square } = BRAND_MARK;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">` +
    `<g stroke="${color}" stroke-width="1.4" stroke-linecap="round" opacity="0.3">` +
    arcs.map((d) => `<path d="${d}"/>`).join('') +
    `</g>` +
    `<path d="${link}" stroke="${color}" stroke-width="2.4" stroke-linecap="round" fill="none"/>` +
    `<circle cx="${circle.cx}" cy="${circle.cy}" r="${circle.r}" fill="${color}"/>` +
    `<rect x="${square.x}" y="${square.y}" width="${square.size}" height="${square.size}" rx="${square.rx}" fill="${color}"/>` +
    `</svg>`
  );
}

// The livediagram mark: two connected nodes (a circle joined to a rounded
// square) ringed by a rotational sync arc. Single-colour via currentColor so
// it tints with the accent; sized by the caller. The multiplayer cursors from
// the full logo are dropped here as they'd be illegible at header size.
export function BrandMark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.3">
        {BRAND_MARK.arcs.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {/* The two connected nodes spin 45° about the icon centre on hover.
          transform-box:view-box makes `origin-center` resolve to (12,12). */}
      <g className="origin-center transition-transform duration-300 ease-out [transform-box:view-box] group-hover:[transform:rotate(45deg)] motion-reduce:transition-none">
        <path
          d={BRAND_MARK.link}
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <circle {...BRAND_MARK.circle} fill="currentColor" />
        <rect
          x={BRAND_MARK.square.x}
          y={BRAND_MARK.square.y}
          width={BRAND_MARK.square.size}
          height={BRAND_MARK.square.size}
          rx={BRAND_MARK.square.rx}
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
