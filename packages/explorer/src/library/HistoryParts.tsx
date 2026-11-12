'use client';

// The History dialog's parts (HistoryDialog.tsx; livediagram/docs/specs/013-workspace/history.md "The dialog"): its
// header, the summary strip, a filter chip, a person's disc and the loading skeleton.

import type { Item, ItemEvent } from '@liveworkspace/index-client';
import { PictureDisc } from '@liveworkspace/ui';
import { DAY_MONTH_YEAR } from '@liveworkspace/ui/date-format';
import { usePersonPicture } from '../data/usePeople';
import { useExtras } from '../explorer/extras';
import type { ExplorerContextValue } from '../explorer/context';
import { AppMark } from '../explorer/badges';
import { useOwnerLabel } from '../explorer/rows';
import { DialogCloseButton } from '../ui/Dialog';
import { Glyph, ItemIcon } from '../ui/icons';
import { avatarFill } from '../ui/avatar-fill';
import { FOCUS_RING } from '../ui/classes';
import { initials, personName } from './person-name';
import { relativeSince } from '../time';
import { kindWords } from '../words';
import { eventCountLabel, personColour } from './history';

export const MUTED = 'text-slate-500 dark:text-slate-400';

const fullDate = (at: number) => DAY_MONTH_YEAR.format(at);
export const iso = (at: number) => new Date(at).toISOString();

export function HistoryHeader({
  item,
  titleId,
  renderThumbnail,
  onClose,
}: {
  item: Item;
  titleId: string;
  renderThumbnail: ExplorerContextValue['renderThumbnail'];
  onClose: () => void;
}) {
  const owner = useOwnerLabel(item, true);
  const thumb = renderThumbnail?.(item, 'row');
  const title = item.title || 'Untitled';
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-slate-100 px-5 pb-4 pt-5 sm:px-6 dark:border-slate-800">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500 [&>*]:max-h-full [&>*]:max-w-full [&_svg]:h-6 [&_svg]:w-6">
        {thumb ?? <ItemIcon size={22} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
          History
        </p>
        <h2
          id={titleId}
          className="truncate text-base font-semibold text-slate-900 dark:text-slate-100"
          title={title}
        >
          {title}
        </h2>
        <p className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-xs ${MUTED}`}>
          <AppMark app={item.app} size={14} />
          <span aria-hidden>{kindWords(item.app).one}</span>
          <span aria-hidden>·</span>
          <span className="truncate">
            <span className="sr-only">Owner: </span>
            {owner}
          </span>
        </p>
      </div>
      <DialogCloseButton onClick={onClose} />
    </div>
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
  const stat = 'flex min-w-0 flex-col gap-0.5';
  const term = `text-[10px] font-semibold uppercase tracking-wider ${MUTED}`;
  const value = 'truncate text-sm font-medium text-slate-800 dark:text-slate-100';
  return (
    <dl
      data-history-summary=""
      className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3 sm:grid-cols-4 sm:px-6 dark:border-slate-800 dark:bg-slate-800/40"
    >
      <div className={stat}>
        <dt className={term}>Created</dt>
        <dd className={value}>
          <time dateTime={iso(item.createdAt)} title={fullDate(item.createdAt)}>
            {fullDate(item.createdAt)}
          </time>
        </dd>
      </div>
      <div className={stat}>
        <dt className={term}>Last changed</dt>
        <dd className={value}>
          <time dateTime={iso(item.updatedAt)} title={fullDate(item.updatedAt)}>
            {relativeSince(item.updatedAt, now)}
          </time>
        </dd>
      </div>
      <div className={stat}>
        <dt className={term}>People</dt>
        <dd className={`flex items-center gap-1.5 ${value}`}>
          <span className="flex -space-x-1" aria-hidden>
            {people.slice(0, 3).map((e) => (
              <PersonAvatar key={e.actorId} event={e} viewerId={viewerId} size={22} ring />
            ))}
          </span>
          <span>
            {people.length}
            {more ? '+' : ''}
          </span>
        </dd>
      </div>
      <div className={stat}>
        <dt className={term}>Events</dt>
        <dd className={value}>{eventCountLabel(count, more)}</dd>
      </div>
    </dl>
  );
}

export function Chip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition duration-micro ${FOCUS_RING} ${
        on
          ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white'
      }`}
    >
      {label}
      <span className={`tabular-nums ${on ? 'text-white/80' : MUTED}`}>{count}</span>
    </button>
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
  const fill = !mine && letters && event.actorId ? avatarFill(personColour(event.actorId)) : null;
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
    <div aria-busy="true" aria-label="Loading history" className="px-5 py-4 sm:px-6">
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
