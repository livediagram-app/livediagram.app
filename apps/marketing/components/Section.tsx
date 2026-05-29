import type { ReactNode } from 'react';

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description: string;
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
          <p className="mt-4 text-lg leading-relaxed text-slate-600">{description}</p>
        </div>
        {children ? <div className="mt-14">{children}</div> : null}
      </div>
    </section>
  );
}

type FeatureProps = {
  title: string;
  description: string;
};

export function FeatureGrid({ items }: { items: FeatureProps[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-lg border border-slate-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-sm"
        >
          <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
        </div>
      ))}
    </div>
  );
}
