import { ctaHref } from '@livediagram/api-schema';

import { StartDrawingArt } from '@/components/StartDrawingArt';

// The brand-blue "just try it" card that closes the FAQ and the comparison pages: a line of copy and the
// Start drawing CTA (docs/specs/019-marketing/marketing-site.md: the primary CTA reads "Start drawing"), measured
// as `<surface>.Card` by the landing funnel. `art` is for a card that sits in a grid of taller cards: the landing
// page's drawing illustration fills the space above the copy, so the card never shows an empty middle.
export function TryItCard({
  title,
  body,
  source,
  art = false,
  className = '',
}: {
  title: string;
  body: string;
  source: 'Faq.Card' | 'Compare.Card';
  art?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative flex flex-col items-start justify-between overflow-hidden rounded-2xl bg-brand-700 p-6 text-white dark:bg-brand-700 ${className}`}
    >
      {art && (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/0.14)_1px,transparent_1px)] [background-size:14px_14px]"
          />
          <div className="relative flex w-full flex-1 items-center justify-center py-4">
            <StartDrawingArt className="h-28 w-full max-w-xs" />
          </div>
        </>
      )}
      <div className="relative">
        <p className={art ? 'text-xl font-semibold tracking-tight' : 'font-semibold'}>{title}</p>
        <p className="mt-1 text-sm text-brand-50">{body}</p>
      </div>
      <a
        href={ctaHref('/new', source)}
        className="relative mt-5 inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-brand-700 shadow-sm transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white dark:bg-slate-900 dark:text-brand-300 dark:hover:bg-slate-800"
      >
        Start drawing
      </a>
    </div>
  );
}
