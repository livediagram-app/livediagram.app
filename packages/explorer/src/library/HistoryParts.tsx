'use client';

// The History dialog's parts (HistoryDialog.tsx; livediagram/docs/specs/013-workspace/history.md "The dialog"): its
// header, the overview card with its activity bars, a person's disc and the loading skeletons.

import type { Item, ItemEvent } from '@liveworkspace/index-client';
import { Chip, PictureDisc } from '@liveworkspace/ui';
import { createContext, useContext, useMemo } from 'react';
import { DAY_MONTH, DAY_MONTH_YEAR } from '@liveworkspace/ui/date-format';
import { usePersonPicture } from '../data/usePeople';
import { useExtras } from '../explorer/extras';
import { AppMark } from '../explorer/badges';
import { useOwnerLabel } from '../explorer/rows';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { historyHeroArt } from '@liveworkspace/ui/dialog-hero-art/history';
import { Glyph } from '../ui/icons';
import { avatarFill } from '../ui/avatar-fill';
import { initials, personName } from './person-name';
import { relativeSince } from '../time';
import { kindWords } from '../words';
import { activityByDay, eventCountLabel, personColour, type ActivityDay } from './history';

export const MUTED = 'text-slate-500 dark:text-slate-400';

/** The reader's own avatar as their account menu draws it (its fill, initials and picture), so History shows the
 *  same face (owner, 2026-11-17). Null where the host has none: their name's initials on the brand. */
export type ViewerLook = { fill: string; initials: string; picture: string | null };
export const ViewerLookContext = createContext<ViewerLook | null>(null);

const fullDate = (at: number) => DAY_MONTH_YEAR.format(at);
export const iso = (at: number) => new Date(at).toISOString();

// The dialog hero header (liveworkspace/docs/specs/004-index/dialog-hero-header.md): the item's record over time drawn
// in the band, the item's name its heading, and its one line naming it History, its app (the mark and kind word) and
// its owner.
export function HistoryHeader({
  item,
  titleId,
  onClose,
}: {
  item: Item;
  titleId: string;
  onClose: () => void;
}) {
  const owner = useOwnerLabel(item, true);
  const title = item.title || 'Untitled';
  return (
    <HeroDialogHeader
      art={historyHeroArt}
      titleId={titleId}
      title={<span title={title}>{title}</span>}
      subtitle={
        <span className="flex min-w-0 items-center gap-1.5">
          <span>History</span>
          <span aria-hidden>·</span>
          <AppMark app={item.app} size={14} />
          <span aria-hidden>{kindWords(item.app).one}</span>
          <span aria-hidden>·</span>
          <span className="truncate">
            <span className="sr-only">Owner: </span>
            {owner}
          </span>
        </span>
      }
      onClose={onClose}
    />
  );
}

export function SummaryStrip({
  item,
  now,
  count,
  more,
  people,
  viewerId,
  events,
}: {
  item: Item;
  now: number;
  count: number;
  more: boolean;
  people: ItemEvent[];
  viewerId: string | null;
  events: readonly ItemEvent[];
}) {
  // One card (history.md "At a glance", owner 2026-11-17: the four tiles read poorly): when it last changed with the
  // faces beside it, when it was made and how much has happened, then its last two weeks as a bar a day.
  const days = useMemo(() => activityByDay(events, now), [events, now]);
  return (
    <div className="shrink-0 border-b border-slate-100 px-3 py-3 dark:border-slate-800">
      <section
        data-history-summary=""
        aria-label="At a glance"
        className={`flex flex-col gap-3 rounded-xl p-3 ${CARD}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <dl className="flex min-w-0 flex-1 flex-col-reverse gap-0.5">
            <div className={`flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] ${MUTED}`}>
              <dt className="sr-only">Created</dt>
              <dd>
                Created{' '}
                <time dateTime={iso(item.createdAt)} title={fullDate(item.createdAt)}>
                  {fullDate(item.createdAt)}
                </time>
              </dd>
              <span aria-hidden>·</span>
              <dt className="sr-only">Events</dt>
              <dd className="tabular-nums">{eventCountLabel(count, more)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="sr-only">Last changed</dt>
              <dd className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Changed{' '}
                <time dateTime={iso(item.updatedAt)} title={fullDate(item.updatedAt)}>
                  {relativeSince(item.updatedAt, now)}
                </time>
              </dd>
            </div>
          </dl>
          {/* Who took part, as their faces (owner, 2026-11-17): up to five, then +N; names on hover. */}
          {people.length ? (
            <div data-history-people="" className="flex shrink-0 items-center pt-0.5">
              <span className="sr-only">People: </span>
              <span className="flex -space-x-1.5">
                {people.slice(0, PEOPLE_SHOWN).map((e) => {
                  const name = viewerId && e.actorId === viewerId ? 'You' : personName(e);
                  return (
                    <span key={e.actorId} title={name} className="relative flex hover:z-10">
                      <PersonAvatar event={e} viewerId={viewerId} size={26} ring />
                      <span className="sr-only">{name}</span>
                    </span>
                  );
                })}
              </span>
              {people.length > PEOPLE_SHOWN || more ? (
                <Chip className="ml-1 bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  +{Math.max(people.length - PEOPLE_SHOWN, 0)}
                  {more ? '…' : ''}
                </Chip>
              ) : null}
            </div>
          ) : null}
        </div>
        <ActivityBars days={days} />
      </section>
    </div>
  );
}

const CARD =
  'border border-slate-200/80 bg-gradient-to-b from-brand-50/60 to-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-slate-700/70 dark:from-brand-500/[0.07] dark:to-slate-900';

// The last two weeks, a bar a day (history.md "At a glance"): heights against the busiest day, an empty day a short
// stub so the run of days still reads, today's bar in the accent.
function ActivityBars({ days }: { days: readonly ActivityDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((n, d) => n + d.count, 0);
  const last = days.length - 1;
  return (
    <figure data-history-activity="" className="flex flex-col gap-1">
      <ol
        aria-label={`Activity over the last ${days.length} days: ${total === 1 ? '1 event' : `${total} events`}`}
        className="flex h-9 items-end gap-[3px]"
      >
        {days.map((d, i) => {
          const words = `${i === last ? 'Today' : DAY_MONTH.format(d.at)}: ${d.count === 1 ? '1 event' : `${d.count} events`}`;
          return (
            <li key={d.key} title={words} className="flex h-full flex-1 items-end">
              <span className="sr-only">{words}</span>
              <span
                aria-hidden
                className={`block w-full rounded-[3px] transition-[height] duration-short ${
                  d.count === 0
                    ? 'bg-slate-200/80 dark:bg-slate-700/70'
                    : i === last
                      ? 'bg-brand-600 dark:bg-brand-400'
                      : 'bg-brand-300 dark:bg-brand-500/60'
                }`}
                style={{ height: d.count === 0 ? 3 : `${Math.max(18, (d.count / max) * 100)}%` }}
              />
            </li>
          );
        })}
      </ol>
      <figcaption aria-hidden className={`flex justify-between text-[10px] ${MUTED}`}>
        <span>2 weeks ago</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}

// Faces shown before +N.
const PEOPLE_SHOWN = 5;

/** The overview card's skeleton, in its shape, while the first page loads. */
export function SummarySkeleton() {
  const bar = 'rounded bg-slate-200/80 motion-safe:animate-pulse dark:bg-slate-700/70';
  return (
    <div aria-hidden className="shrink-0 border-b border-slate-100 px-3 py-3 dark:border-slate-800">
      <div className={`flex flex-col gap-3 rounded-xl p-3 ${CARD}`}>
        <div className="flex items-start gap-3">
          <span className="flex flex-1 flex-col gap-1.5 pt-0.5">
            <span className={`h-4 w-40 ${bar}`} />
            <span className={`h-3 w-32 ${bar}`} />
          </span>
          <span className={`size-[26px] rounded-full ${bar}`} />
        </div>
        <span className="flex h-9 items-end gap-[3px]">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className={`h-[3px] flex-1 rounded-[3px] ${bar}`} />
          ))}
        </span>
        <span className="-mt-2 h-[13px]" />
      </div>
    </div>
  );
}

/** A person's avatar: their picture where they have one, else their initials on a disc in their colour. The reader
 *  wears their own too (owner, 2026-11-17: it was a brand disc with the person glyph), their initials on the brand;
 *  someone unnamed wears the person glyph. */
export function PersonAvatar({
  event,
  viewerId,
  size,
  ring = false,
}: {
  event: ItemEvent;
  viewerId: string | null;
  size: number;
  ring?: boolean;
}) {
  const mine = Boolean(viewerId && event.actorId === viewerId);
  const letters = initials(personName(event));
  // The reader wears the brand; someone unnamed or a closed account stays grey. Anyone with a picture (their own
  // included) shows it over their disc (the one people store, which names them too).
  const fill =
    !mine && letters && event.actorId ? avatarFill(personColour(personName(event))) : null;
  const { people } = useExtras();
  const picture = usePersonPicture(
    people,
    event.actorId && event.actorId !== 'deleted' ? event.actorId : null,
  );
  const look = useContext(ViewerLookContext);
  if (mine && look)
    return (
      <PictureDisc
        aria-hidden
        pictureUrl={look.picture ?? picture}
        name={personName(event)}
        size={size}
        className={`font-semibold text-white ${ring ? 'ring-2 ring-white dark:ring-slate-900' : ''}`}
        style={{ fontSize: Math.round(size * 0.42), backgroundColor: look.fill }}
      >
        {look.initials}
      </PictureDisc>
    );
  return (
    <PictureDisc
      aria-hidden
      pictureUrl={picture}
      name={personName(event)}
      size={size}
      className={`font-semibold text-white [&_svg]:h-[60%] [&_svg]:w-[60%] ${
        fill ? '' : mine ? 'bg-brand-700 dark:bg-brand-600' : 'bg-slate-400 dark:bg-slate-600'
      } ${ring ? 'ring-2 ring-white dark:ring-slate-900' : ''}`}
      style={{
        fontSize: Math.round(size * 0.42),
        ...(fill ? { backgroundColor: fill } : null),
      }}
    >
      {letters ?? <PersonGlyph />}
    </PictureDisc>
  );
}

function PersonGlyph() {
  return (
    <Glyph size={24} units={24}>
      <path d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0" />
    </Glyph>
  );
}

export function HistorySkeleton() {
  const bar = 'rounded bg-slate-200/80 motion-safe:animate-pulse dark:bg-slate-700/70';
  return (
    <div role="status" aria-busy="true" aria-label="Loading history" className="px-5 py-4 sm:px-6">
      <span className={`mb-4 block h-3 w-20 ${bar}`} />
      {[0.7, 0.5, 0.6, 0.4].map((w, i) => (
        <div key={i} className="flex gap-3 pb-5">
          <span className={`h-8 w-8 shrink-0 rounded-full ${bar}`} />
          <span className="flex flex-1 flex-col gap-2 pt-1">
            <span className={`h-3.5 ${bar}`} style={{ width: `${w * 100}%` }} />
            <span className={`h-3 w-1/3 ${bar}`} />
          </span>
        </div>
      ))}
    </div>
  );
}
