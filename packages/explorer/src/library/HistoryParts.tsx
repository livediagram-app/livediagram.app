'use client';

// The History dialog's parts (HistoryDialog.tsx; livediagram/docs/specs/013-workspace/history.md "The dialog"): its
// header, the summary strip, a filter chip, a person's disc and the loading skeleton.

import type { Item, ItemEvent } from '@liveworkspace/index-client';
import { PictureDisc } from '@liveworkspace/ui';
import { DAY_MONTH_YEAR } from '@liveworkspace/ui/date-format';
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
import { eventCountLabel, personColour } from './history';

export const MUTED = 'text-slate-500 dark:text-slate-400';

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
}: {
  item: Item;
  now: number;
  count: number;
  more: boolean;
  people: ItemEvent[];
  viewerId: string | null;
}) {
  // Four tiles (owner, 2026-11-17: the plain row read too basic): each a glyph on a soft disc, the value large, its
  // name under it. Two by two in Tools' width, four across in a wide dialog.
  return (
    <div className="@container shrink-0 border-b border-slate-100 dark:border-slate-800">
      <dl
        data-history-summary=""
        className="grid grid-cols-2 gap-2 px-4 py-3 sm:px-5 @[36rem]:grid-cols-4"
      >
        <SummaryTile label="Created" glyph={GLYPH_CREATED} tone="brand">
          <time dateTime={iso(item.createdAt)} title={fullDate(item.createdAt)}>
            {fullDate(item.createdAt)}
          </time>
        </SummaryTile>
        <SummaryTile label="Last Changed" glyph={GLYPH_CHANGED} tone="amber">
          <time dateTime={iso(item.updatedAt)} title={fullDate(item.updatedAt)}>
            {relativeSince(item.updatedAt, now)}
          </time>
        </SummaryTile>
        {/* Who was involved, as their faces alone (owner, 2026-11-17): up to five, then +N; names on hover. */}
        <div
          data-history-people=""
          className="flex min-w-0 items-center rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-slate-700/70 dark:bg-slate-900"
        >
          <dt className="sr-only">People</dt>
          <dd className="flex min-w-0 items-center">
            <span className="flex -space-x-2">
              {people.slice(0, PEOPLE_SHOWN).map((e) => {
                const name = viewerId && e.actorId === viewerId ? 'You' : personName(e);
                return (
                  <span key={e.actorId} title={name} className="relative flex hover:z-10">
                    <PersonAvatar event={e} viewerId={viewerId} size={30} ring />
                    <span className="sr-only">{name}</span>
                  </span>
                );
              })}
            </span>
            {people.length > PEOPLE_SHOWN || more ? (
              <span className="ml-1.5 shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                +{Math.max(people.length - PEOPLE_SHOWN, 0)}
                {more ? '…' : ''}
              </span>
            ) : null}
          </dd>
        </div>
        <SummaryTile label="Events" glyph={GLYPH_EVENTS} tone="emerald">
          <span className="tabular-nums">{eventCountLabel(count, more)}</span>
        </SummaryTile>
      </dl>
    </div>
  );
}

const TONES = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
} as const;

// Lucide's calendar-plus, pencil-line and activity, at 24 units.
const GLYPH_CREATED = (
  <>
    <path d="M8 2v4M16 2v4M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8M3 10h18M16 19h6M19 16v6" />
  </>
);
const GLYPH_CHANGED = (
  <>
    <path d="M12 20h9" />
    <path d="M16.4 3.6a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
  </>
);
// Faces shown in the People tile before +N.
const PEOPLE_SHOWN = 5;
const GLYPH_EVENTS = <path d="M22 12h-4l-3 9L9 3l-3 9H2" />;

function SummaryTile({
  label,
  glyph,
  tone,
  children,
}: {
  label: string;
  glyph: React.ReactNode;
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-slate-700/70 dark:bg-slate-900">
      <span
        aria-hidden
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}
      >
        <Glyph size={16} units={24}>
          {glyph}
        </Glyph>
      </span>
      {/* The value reads first, its name under it; in the DOM the name comes first, as a list of terms needs. */}
      <div className="flex min-w-0 flex-col-reverse">
        <dt className={`text-[11px] leading-tight ${MUTED}`}>{label}</dt>
        <dd className="truncate text-[13px] font-semibold leading-tight text-slate-900 dark:text-slate-50">
          {children}
        </dd>
      </div>
    </div>
  );
}

/** A person's initials on a disc in their colour; the reader is "You", and someone unnamed wears the person glyph. */
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
  const letters = mine ? null : initials(personName(event));
  // The reader wears the brand; someone unnamed or a closed account stays grey. Anyone else with a Google picture
  // shows it over their disc (the one people store, which names them too).
  const fill =
    !mine && letters && event.actorId ? avatarFill(personColour(personName(event))) : null;
  const { people } = useExtras();
  const picture = usePersonPicture(
    people,
    !mine && event.actorId && event.actorId !== 'deleted' ? event.actorId : null,
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
