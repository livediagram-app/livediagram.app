export type BrandSize = 'sm' | 'md';

export type BrandProps = {
  href?: string;
  size?: BrandSize;
  className?: string;
};

const sizeClasses: Record<BrandSize, string> = {
  sm: 'text-base font-semibold tracking-tight',
  md: 'text-lg font-semibold tracking-tight',
};

export function Brand({ href, size = 'md', className = '' }: BrandProps) {
  const classes = `${sizeClasses[size]} text-slate-900 ${className}`.trim();
  const content = (
    <>
      live<span className="text-brand-500">diagram</span>
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
