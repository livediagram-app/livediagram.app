'use client';

// Home's first run (livediagram's HomeWelcome): for a person with nothing yet, three sections in place of Jump Back
// In and What Happened. Start Blank (the app's blanks), Popular Templates (its Popular list's first eight, with
// Browse All Templates), and Already Have Work? (the way back for a guest who may have been signed out). Each start
// makes its item at once in its app. The pictures are the manifest's static SVGs, drawn as images.

import { useEffect, useState, type ReactNode } from 'react';
import { FOCUS_RING, MUTED } from '../ui/classes';
import { PlusIcon, SearchIcon } from '../ui/icons';
import { useExplorer } from '../explorer/context';
import { useFirstRun } from './context';
import { signInLine, WELCOME_COPY, type WelcomeStart } from './types';

const SECTION_HEADING =
  'text-2xl font-extrabold tracking-[-0.03em] text-[#17153a] dark:text-slate-100';
const SECTION_LINK =
  'inline-flex min-h-6 items-center rounded-sm text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300';
const CARD_SURFACE =
  'border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-brand-300 hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand-300)_25%,transparent),0_18px_36px_-16px_color-mix(in_oklab,var(--color-brand-600)_45%,transparent)] motion-safe:hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-400/60';

/** A start's picture: the host's, or the manifest's SVG as an image (an image runs no script). */
export function StartPicture({ start }: { start: WelcomeStart }) {
  const { welcome } = useFirstRun();
  const own = welcome?.renderPicture?.(start);
  if (own) return <>{own}</>;
  return (
    <span className="flex h-full w-full items-center justify-center rounded-lg bg-slate-50 p-2 dark:bg-slate-900/60">
      {start.svg ? (
        <img
          alt=""
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(start.svg)}`}
          className="h-full w-auto max-w-full object-contain"
          draggable={false}
        />
      ) : null}
    </span>
  );
}

function Section({
  id,
  title,
  link,
  children,
}: {
  id: string;
  title: string;
  link?: { href: string; label: string; onFollow?: () => void };
  children: ReactNode;
}) {
  const headingId = `home-${id}`;
  return (
    <section aria-labelledby={headingId} data-home-section={id}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id={headingId} className={SECTION_HEADING}>
          {title}
        </h2>
        {link ? (
          <a href={link.href} onClick={link.onFollow} className={`${SECTION_LINK} ${FOCUS_RING}`}>
            {link.label}
          </a>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** One start: a blank (a smaller card) or a template (a large one). */
function StartCard({ start, size }: { start: WelcomeStart; size: 'blank' | 'template' }) {
  const { welcome } = useFirstRun();
  const blank = size === 'blank';
  return (
    <a
      href={start.href}
      data-welcome-start={start.id}
      onClick={() => welcome?.onSelected?.(blank ? 'Welcome.Blank' : 'Welcome.Template')}
      className={`flex h-full min-w-0 flex-col gap-2.5 rounded-[18px] p-2 pb-3 ${CARD_SURFACE} ${FOCUS_RING}`}
    >
      <span aria-hidden className={`block w-full ${blank ? 'h-24' : 'h-32'}`}>
        <StartPicture start={start} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-1">
        <span
          className={`truncate font-semibold text-[#17153a] dark:text-slate-100 ${
            blank ? 'text-sm' : 'text-[15px]'
          }`}
        >
          {start.name}
        </span>
        {start.description ? (
          <span className={`line-clamp-2 text-xs leading-[18px] ${MUTED}`}>
            {start.description}
          </span>
        ) : null}
      </span>
    </a>
  );
}

function StartSkeleton({ count, tall }: { count: number; tall: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} aria-hidden className="min-w-0">
          <span
            className={`block rounded-[18px] bg-slate-200/70 motion-safe:animate-pulse dark:bg-slate-800 ${
              tall ? 'h-[13.5rem]' : 'h-[11.5rem]'
            }`}
          />
        </li>
      ))}
    </>
  );
}

export function HomeWelcome({ withSearch = false }: { withSearch?: boolean }) {
  const { welcome } = useFirstRun();
  const { kind } = useExplorer();
  const onOpened = welcome?.onOpened;
  useEffect(() => {
    onOpened?.();
  }, [onOpened]);
  if (!welcome) return null;
  const m = welcome.manifest;
  return (
    <div className="flex flex-col gap-10" data-home-welcome="" aria-busy={!m}>
      {withSearch ? (
        <div className="max-w-2xl">
          <WelcomeSearch />
        </div>
      ) : null}
      <Section id="start-blank" title={WELCOME_COPY.blanksTitle}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {m ? (
            m.blanks.map((s) => (
              <li key={s.id} className="min-w-0">
                <StartCard start={s} size="blank" />
              </li>
            ))
          ) : (
            <StartSkeleton count={3} tall={false} />
          )}
        </ul>
      </Section>
      <Section
        id="popular-templates"
        title={WELCOME_COPY.popularTitle}
        link={
          m
            ? {
                href: m.allTemplatesHref,
                label: WELCOME_COPY.allTemplates,
                onFollow: () => welcome.onSelected?.('Welcome.AllTemplates'),
              }
            : undefined
        }
      >
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {m ? (
            m.popular.map((s) => (
              <li key={s.id} className="min-w-0">
                <StartCard start={s} size="template" />
              </li>
            ))
          ) : (
            <StartSkeleton count={4} tall />
          )}
        </ul>
      </Section>
      {!welcome.signedIn && welcome.signInHref ? (
        <Section id="have-work" title={WELCOME_COPY.haveWorkTitle}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative flex flex-col gap-3 overflow-hidden rounded-[20px] bg-[#0b1230] p-5 dark:ring-1 dark:ring-brand-400/30">
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 size-[180px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-brand-400)_45%,transparent),transparent_70%)]"
              />
              <h3 className="relative text-base font-bold text-white">
                {WELCOME_COPY.signInTitle}
              </h3>
              <p className="relative text-sm leading-relaxed text-[#a9b8d0]">
                {signInLine(m?.name ?? 'liveworkspace', kind.lowerMany)}
              </p>
              <a
                href={welcome.signInHref}
                onClick={() => welcome.onSelected?.('Welcome.SignIn')}
                className="relative mt-auto inline-flex h-10 items-center self-start rounded-xl bg-white px-4 text-sm font-semibold text-[#0b1230] transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              >
                {WELCOME_COPY.signIn}
              </a>
            </div>
          </div>
        </Section>
      ) : null}
    </div>
  );
}

/** The first run's field: the hero's large field, searching the app's templates (there is nothing of the
 *  person's to search). Enter opens the app's New wizard on the words; Start Blank sits inside its end. */
export function WelcomeSearch() {
  const { welcome } = useFirstRun();
  const [words, setWords] = useState('');
  const m = welcome?.manifest ?? null;
  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (!m) return;
        welcome?.onSelected?.('Welcome.Search');
        const q = words.trim();
        window.location.assign(q ? m.searchHref(q) : m.allTemplatesHref);
      }}
    >
      <div className="flex h-[60px] items-center gap-3 rounded-[18px] border-2 border-brand-200 bg-white pl-[18px] pr-2 text-base shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-brand-300)_22%,transparent),0_18px_40px_-20px_color-mix(in_oklab,var(--color-brand-600)_45%,transparent)] focus-within:border-brand-400 dark:border-brand-400/40 dark:bg-slate-800 dark:shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-brand-400)_12%,transparent)] dark:focus-within:border-brand-400">
        <span aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400">
          <SearchIcon size={18} />
        </span>
        <input
          type="search"
          aria-label={WELCOME_COPY.searchLabel}
          value={words}
          onChange={(e) => setWords(e.target.value)}
          placeholder={WELCOME_COPY.searchPlaceholder}
          autoComplete="off"
          className="h-full min-w-[8rem] flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400"
        />
        <a
          href={m?.startBlankHref ?? '#'}
          aria-label={WELCOME_COPY.startBlank}
          aria-disabled={!m || undefined}
          onClick={() => welcome?.onSelected?.('Welcome.StartBlank')}
          className={`flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-[18px] text-[15px] font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 ${FOCUS_RING}`}
        >
          <PlusIcon size={14} />
          {/* The label folds to the plus on a phone; the link keeps its name. */}
          <span className="hidden sm:inline">{WELCOME_COPY.startBlank}</span>
        </a>
      </div>
    </form>
  );
}

/** The hero's art on a first run: three of the starts' previews fanned, the front one first. */
export function WelcomeFan() {
  const { welcome } = useFirstRun();
  const m = welcome?.manifest;
  if (!m) return null;
  const all = [...m.blanks, ...m.popular];
  const fan = m.fan.flatMap((id) => all.filter((s) => s.id === id)).slice(0, 3);
  // Back to front: the last drawn sits on top.
  const places = [
    'left-[4%] top-[14%] -rotate-6',
    'right-[2%] top-[2%] rotate-6',
    'left-[20%] top-[22%] rotate-0',
  ];
  const order = [fan[1], fan[2], fan[0]];
  return (
    <div aria-hidden className="relative h-full w-full" data-welcome-fan="">
      {order.map((s, i) =>
        s ? (
          <span
            key={s.id}
            className={`absolute h-[62%] w-[58%] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_48px_-24px_color-mix(in_oklab,var(--color-brand-700)_45%,transparent)] dark:border-slate-700 dark:bg-slate-800 ${places[i]}`}
          >
            <StartPicture start={s} />
          </span>
        ) : null,
      )}
    </div>
  );
}
