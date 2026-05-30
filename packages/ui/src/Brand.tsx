export type BrandSize = 'sm' | 'md';

export type BrandProps = {
  href?: string;
  size?: BrandSize;
  className?: string;
  // Override colour for the "diagram" half of the wordmark. Used by
  // the editor header to tint the logo with the active tab's theme
  // accent — when unset, falls back to the brand-500 utility.
  accentColor?: string;
};

const sizeClasses: Record<BrandSize, string> = {
  sm: 'text-base font-semibold tracking-tight',
  md: 'text-lg font-semibold tracking-tight',
};

export function Brand({ href, size = 'md', className = '', accentColor }: BrandProps) {
  const classes = `${sizeClasses[size]} text-slate-900 ${className}`.trim();
  const accentStyle: React.CSSProperties = accentColor
    ? { color: accentColor, transition: 'color 200ms ease-out' }
    : { transition: 'color 200ms ease-out' };
  const content = (
    <>
      live
      <span className={accentColor ? '' : 'text-brand-500'} style={accentStyle}>
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
