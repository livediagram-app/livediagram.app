export type BrandSize = 'sm' | 'md';

export type BrandProps = {
  href?: string;
  size?: BrandSize;
  className?: string;
  // Override colour for the "diagram" half of the wordmark and the logo
  // mark. Used by the editor header to tint the logo with the active tab's
  // theme accent — when unset, falls back to the brand-500 utility.
  accentColor?: string;
};

const sizeClasses: Record<BrandSize, string> = {
  sm: 'text-base font-semibold tracking-tight',
  md: 'text-lg font-semibold tracking-tight',
};

const BRAND_500 = '#0ea5e9';

export function Brand({ href, size = 'md', className = '', accentColor }: BrandProps) {
  const classes =
    `inline-flex items-center gap-1.5 ${sizeClasses[size]} text-slate-900 ${className}`.trim();
  const accentStyle: React.CSSProperties = accentColor
    ? { color: accentColor, transition: 'color 200ms ease-out' }
    : { transition: 'color 200ms ease-out' };
  const content = (
    <>
      <BrandMark
        className={`${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} shrink-0`}
        style={{ color: accentColor ?? BRAND_500, transition: 'color 200ms ease-out' }}
      />
      <span>
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

// The livediagram mark: two connected nodes (a circle joined to a rounded
// square) ringed by a rotational sync arc. Single-colour via currentColor so
// it tints with the accent; sized by the caller. The multiplayer cursors from
// the full logo are dropped here as they'd be illegible at header size.
function BrandMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.3">
        <path d="M16.8 3.8 A9.5 9.5 0 0 1 16.8 20.2" />
        <path d="M7.2 20.2 A9.5 9.5 0 0 1 7.2 3.8" />
      </g>
      <path
        d="M15 11.6 C15 14.4 10.2 11.4 10 14.2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="15.2" cy="9" r="2.9" fill="currentColor" />
      <rect x="6.6" y="12.4" width="5.8" height="5.8" rx="1.9" fill="currentColor" />
    </svg>
  );
}
