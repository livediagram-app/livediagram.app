'use client';

// The parts every Home section shares (HomePane, HomeSpaces): the section with its heading and its See link, the
// surfaces its cards are drawn on, and the failed read's notice, so a new section looks like the ones around it.

import type { MouseEvent, ReactNode } from 'react';
import { FOCUS_RING, SECTION_LINK } from '../ui/classes';
import type { ExplorerView } from '../views';
import { useExplorer } from './context';

export const SECTION_HEADING =
  'text-2xl font-extrabold tracking-[-0.03em] text-[#17153a] dark:text-slate-100';
export const PANEL_SURFACE =
  'border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-800';
export const CARD_SURFACE = `${PANEL_SURFACE} transition duration-micro hover:border-brand-300 hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand-300)_25%,transparent),0_18px_36px_-16px_color-mix(in_oklab,var(--color-brand-600)_45%,transparent)] motion-safe:hover:-translate-y-0.5 dark:hover:border-brand-400/60`;
export const THUMB_EDGE =
  'flex items-center justify-center overflow-hidden border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900';
export const CARD_NAME = 'block truncate font-semibold text-[#17153a] dark:text-slate-100';

export function HomeSection({
  id,
  title,
  link,
  busy,
  onPick,
  children,
}: {
  id: string;
  title: string;
  link?: { view: ExplorerView; label: string; onFollow?: () => void };
  busy: boolean;
  /** A link in the section followed (a click, a tap or Enter): `true` for its See link (the heading's, or the
   *  phone strip's tile), `false` for a card. Read from the one click as it rises, so no card carries a handler. */
  onPick?: (seeLink: boolean) => void;
  children: ReactNode;
}) {
  const { viewHref, navigate } = useExplorer();
  const headingId = `home-${id}`;
  const picked = onPick
    ? (e: MouseEvent<HTMLElement>) => {
        const followed = (e.target as Element).closest?.('a[href]');
        // Only a link drawn in the section: a menu opened from a card renders elsewhere in the page.
        if (followed && e.currentTarget.contains(followed))
          onPick(followed.hasAttribute('data-see-link'));
      }
    : undefined;
  return (
    <section aria-labelledby={headingId} aria-busy={busy} data-home-section={id} onClick={picked}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id={headingId} className={SECTION_HEADING}>
          {title}
        </h2>
        {link ? (
          <a
            href={viewHref(link.view)}
            onClick={(e) => {
              link.onFollow?.();
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              navigate(link.view);
            }}
            className={`${SECTION_LINK} ${FOCUS_RING}`}
            data-see-link=""
          >
            {link.label}
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A Home read that failed: what couldn't load, and Try Again. */
export function HomeFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
    >
      {message}{' '}
      <button type="button" className="font-semibold underline" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
