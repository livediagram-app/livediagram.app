import type { ReactNode } from 'react';

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  variant?: 'default' | 'tinted';
};

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  variant = 'default',
}: SectionProps) {
  const bg = variant === 'tinted' ? 'bg-brand-50/60' : 'bg-white';
  return (
    <section id={id} className={`${bg} border-t border-slate-200/70`}>
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          {eyebrow ? (
            <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-4 text-lg leading-relaxed text-slate-600">{description}</p>
          ) : null}
        </div>
        {children ? <div className="mt-14">{children}</div> : null}
      </div>
    </section>
  );
}

export type FeatureProps = {
  title: string;
  description: string;
  /** Optional animated mini-illustration rendered above the text. */
  art?: ReactNode;
  /** Help-centre article this feature is documented in. When set, the whole
   *  card becomes a link to it (opens in a new tab). Cross-app absolute path
   *  under `/help` (the router serves the help app there). */
  href?: string;
};

export function FeatureGrid({ items }: { items: FeatureProps[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <FeatureCard key={item.title} {...item} />
      ))}
    </div>
  );
}

function FeatureCard({ title, description, art, href }: FeatureProps) {
  const body = (
    <>
      {art}
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      {href ? (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition-colors group-hover:text-brand-700">
          Learn more
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          >
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
          <span className="sr-only">(opens in a new tab)</span>
        </span>
      ) : null}
    </>
  );

  const className =
    'block rounded-lg border border-slate-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-sm';

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group ${className} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}
    >
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}
