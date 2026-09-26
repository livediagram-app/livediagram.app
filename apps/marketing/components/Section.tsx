import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@livediagram/ui';
import { featureAnchor } from '@/lib/feature-anchor';

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
  /**
   * Optional sub-section label. On a `/features/<id>` detail page, a section
   * whose items carry `group` values renders its grid broken into captioned
   * sub-sections (grouping related items) instead of one long grid, so the
   * larger categories stay scannable. Sections without groups render flat.
   */
  group?: string;
  /** Help-centre article this feature is documented in. When set, the whole
   *  card becomes a link to it (opens in a new tab). Cross-app absolute path
   *  under `/help` (the router serves the help app there). */
  href?: string;
};

export function FeatureGrid({ items }: { items: FeatureProps[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {/* Each card rises in as it scrolls into view (page-motion.css). The
          entrance is on this wrapper, not the card, whose hover lift is a
          transform the animation would otherwise pin. */}
      {items.map((item) => (
        <div key={item.title} className="enter-on-scroll">
          <FeatureCard {...item} />
        </div>
      ))}
    </div>
  );
}

function FeatureCard({ title, description, art, href }: FeatureProps) {
  // Full-height flex column: the text block grows to fill, so the "Learn more"
  // footer bar pins to the bottom edge and lines up across every card in a row
  // (grid rows stretch all cards to a shared height) instead of floating at the
  // end of whichever description happened to be longest.
  const body = (
    <>
      <div className="flex flex-1 flex-col p-6">
        {art}
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
      {href ? (
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-3 text-sm font-medium text-brand-600 transition-colors group-hover:bg-brand-50 group-hover:text-brand-700">
          <span>
            Learn more<span className="sr-only"> (opens in a new tab)</span>
          </span>
          <ChevronRightIcon
            size={15}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </div>
      ) : null}
    </>
  );

  // The card is an anchor target: the landing page's feature badges link to
  // it (spec/16). scroll-mt keeps it clear of the sticky header on arrival.
  const id = featureAnchor(title);
  const className =
    'group flex h-full scroll-mt-24 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md';

  return href ? (
    <a
      id={id}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500`}
    >
      {body}
    </a>
  ) : (
    <div id={id} className={className}>
      {body}
    </div>
  );
}
