'use client';

// Home's What Happened (livediagram's WhatHappened and WhatHappenedEntry): what other people did to the items the
// reader can open, from one page of the index's Timeline, under day headings. A group with one person lists each
// doing as a link that opens the item; a group with several is one sentence that deals out every doing. No filter
// controls: Home's This app / All filter decides whose items, as everywhere. The section is left out while nothing
// has happened, and on a failed read (Home is not where the Timeline's errors are told).

import { useEffect, useId, useMemo, useState, useSyncExternalStore, type MouseEvent } from 'react';
import type { App, IndexClient, TimelineEvent } from '@liveworkspace/index-client';
import { isNewEvent, timeLabel } from '../timeline/model';
import {
  ACTION_PHRASES,
  groupsByDay,
  groupWhatHappened,
  initials,
  peopleList,
  personName,
  updatesLabel,
  verbList,
  VERB_PHRASES,
  WHAT_HAPPENED_PAGE,
  type WhatHappenedGroup,
  type WhatHappenedPerson,
  type WhatHappenedVerb,
} from '../timeline/whatHappened';
import { SOLID_BRAND_DARK_CONTROL, FOCUS_RING, MUTED } from '../ui/classes';
import { ChevronDownIcon, PersonalSpaceIcon } from '../ui/icons';
import type { AppFilter } from '../words';
import { AppMark } from './badges';
import { useExplorer } from './context';
import { isAbort } from '../data/errors';

const PANEL =
  'rounded-[20px] border border-slate-200 bg-white px-3 py-2 sm:px-5 dark:border-slate-700 dark:bg-slate-800';
const ROW = 'rounded-lg px-2 py-2 transition hover:bg-slate-100 dark:hover:bg-slate-800/70';
const STRONG = 'font-semibold text-slate-900 dark:text-slate-100';

const LEVEL_WORDS: Record<string, string> = {
  view: 'Anyone with the link can view',
  participate: 'Anyone with the link can take part',
  edit: 'Anyone with the link can edit',
};

export type WhatHappenedState = {
  events: TimelineEvent[];
  seenAt: number | null;
  loading: boolean;
  error: boolean;
};

/** One read of the index's Timeline per Home visit and filter: its first page, newest first. It does not mark the
 *  Timeline seen, so what is New here is still New there. */
export function useWhatHappened(
  client: IndexClient,
  app: App,
  filter: AppFilter,
  epoch: number,
): WhatHappenedState {
  const only: App | null = filter === 'app' ? app : null;
  const key = `${only ?? '*'}:${epoch}`;
  const [state, setState] = useState<WhatHappenedState & { key: string }>({
    key: '',
    events: [],
    seenAt: null,
    loading: true,
    error: false,
  });
  useEffect(() => {
    const abort = new AbortController();
    client
      .timeline(only ? { app: only, limit: WHAT_HAPPENED_PAGE } : { limit: WHAT_HAPPENED_PAGE }, {
        signal: abort.signal,
      })
      .then(
        (page) =>
          setState({ key, events: page.events, seenAt: page.seenAt, loading: false, error: false }),
        (e: unknown) => {
          if (!isAbort(e)) setState({ key, events: [], seenAt: null, loading: false, error: true });
        },
      );
    return () => abort.abort();
  }, [client, only, key]);
  return state.key === key ? state : { events: [], seenAt: null, loading: true, error: false };
}

/** The groups What Happened draws, from the page and the overlay (a rename made here shows at once). */
export function useWhatHappenedGroups(state: WhatHappenedState): WhatHappenedGroup[] {
  const { overlay, viewerId } = useExplorer();
  const version = useSyncExternalStore(overlay.subscribe, overlay.version, overlay.version);
  return useMemo(
    () =>
      groupWhatHappened(
        state.events
          .map((e) => ({ ...e, item: overlay.apply(e.item) }))
          .filter((e) => !(e.item as { gone?: boolean }).gone),
        viewerId,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is what changes overlay.apply
    [state.events, viewerId, overlay, version],
  );
}

export function WhatHappenedFeed({
  groups,
  seenAt,
}: {
  groups: WhatHappenedGroup[];
  seenAt: number | null;
}) {
  const { viewerId } = useExplorer();
  // The section reads the clock once: New and the day headings must not shift while it is read.
  const [now] = useState(() => Date.now());
  const days = useMemo(() => groupsByDay(groups, now), [groups, now]);
  const isNew = (event: TimelineEvent) => isNewEvent(event, seenAt, viewerId, now);
  return (
    <div className={`flex flex-col gap-3 ${PANEL}`} data-what-happened="">
      {days.map((day) => (
        <div key={day.day}>
          <h3
            id={`home-day-${day.day}`}
            className="mb-1 px-2 pt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400"
          >
            {day.label}
          </h3>
          <ul className="flex flex-col gap-1">
            {day.groups.flatMap((group) =>
              group.summary
                ? [<SummaryEntry key={group.id} group={group} isNew={group.actions.some(isNew)} />]
                : group.actions.map((action) => (
                    <ActionEntry
                      key={action.id}
                      group={group}
                      action={action}
                      isNew={isNew(action)}
                    />
                  )),
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function WhatHappenedSkeleton() {
  return (
    <div className={`flex flex-col gap-3 ${PANEL}`} aria-hidden>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-start gap-3 px-2 py-2">
          <span className="h-7 w-7 shrink-0 rounded-full bg-slate-200/70 motion-safe:animate-pulse dark:bg-slate-700" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-3.5 w-2/3 rounded bg-slate-200/70 motion-safe:animate-pulse dark:bg-slate-700" />
            <span className="h-3 w-1/3 rounded bg-slate-200/70 motion-safe:animate-pulse dark:bg-slate-700" />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Newer than the reader's last look: a New pill, words not colour. */
function NewPill() {
  return (
    <span
      className={`mr-1.5 inline-flex items-center rounded bg-brand-700 px-1.5 py-px align-[1px] text-[9px] font-semibold uppercase text-white ${SOLID_BRAND_DARK_CONTROL}`}
    >
      New
    </span>
  );
}

/** A person's initials on a quiet disc; the index keeps no names, so someone unnamed wears the person glyph. */
function Avatar({ person, size }: { person: WhatHappenedPerson | undefined; size: number }) {
  const letters = person ? initials(person.name) : null;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800 ring-2 ring-white dark:bg-brand-500/20 dark:text-brand-200 dark:ring-slate-800 [&_svg]:h-[60%] [&_svg]:w-[60%]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {letters ?? <PersonalSpaceIcon />}
    </span>
  );
}

function AvatarStack({ people, size }: { people: WhatHappenedPerson[]; size: number }) {
  const shown = people.slice(0, 3);
  return (
    <span className="flex shrink-0 -space-x-2">
      {shown.map((person) => (
        <Avatar key={person.id} person={person} size={size} />
      ))}
    </span>
  );
}

/** Where the item lives: its space, then its folder. */
function useLocation(group: WhatHappenedGroup): string {
  const { folders, teamName } = useExplorer();
  const space = group.item.teamId ? (teamName(group.item.teamId) ?? 'Team') : 'My Work';
  const folder = group.item.folderId ? folders.byId.get(group.item.folderId) : undefined;
  return folder ? `${space} › ${folder.name}` : space;
}

/** The quiet line under a doing: what it changed. */
function actionDetail(event: TimelineEvent, teamName: (id: string | null) => string | null) {
  const detail = event.detail ?? {};
  switch (event.type) {
    case 'renamed':
      return detail.from ? `Was “${detail.from}”` : null;
    case 'moved':
      return `To ${detail.folderName ?? (detail.teamId ? teamName(detail.teamId) : 'My Work')}`;
    case 'shared':
      return LEVEL_WORDS[detail.level ?? ''] ?? null;
    case 'created':
      return detail.source === 'ai'
        ? 'Made by AI'
        : detail.source === 'import'
          ? 'Imported'
          : detail.copiedFrom
            ? 'A copy'
            : null;
    default:
      return null;
  }
}

/** Opens the group's item in its own app, or the Trash for one in it; a modified click keeps the link's own way. */
function useOpen(group: WhatHappenedGroup) {
  const { itemHref, viewHref, navigate, openItem, onHome } = useExplorer();
  const trashed = group.item.trashedAt !== null;
  const href = trashed ? viewHref({ kind: 'trash' }) : itemHref(group.item);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onHome?.('Selected', 'WhatHappened');
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (trashed) navigate({ kind: 'trash' });
    else openItem(group.item);
  };
  return { href, onClick };
}

function ItemName({ group }: { group: WhatHappenedGroup }) {
  return <strong className={STRONG}>{group.item.title || 'Untitled'}</strong>;
}

/** One person's doing: who, what, which item, where it lives, when. */
function ActionEntry({
  group,
  action,
  isNew,
}: {
  group: WhatHappenedGroup;
  action: TimelineEvent;
  isNew: boolean;
}) {
  const { filter, teamName } = useExplorer();
  const person = group.people.find((p) => p.id === action.actorId);
  const [before, after] = ACTION_PHRASES[action.type as WhatHappenedVerb];
  const detail = actionDetail(action, teamName);
  const location = useLocation(group);
  const open = useOpen(group);
  return (
    <li>
      <a
        href={open.href}
        onClick={open.onClick}
        data-what-happened-entry={action.id}
        className={`flex items-start gap-3 ${ROW} ${FOCUS_RING}`}
      >
        <Avatar person={person} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-slate-700 dark:text-slate-300">
            <strong className={STRONG}>{personName(action)}</strong> {before}{' '}
            <ItemName group={group} />
            {after ? ` ${after}` : null}
          </span>
          {detail ? (
            <span className={`mt-0.5 block truncate text-xs ${MUTED}`}>{detail}</span>
          ) : null}
          <span className={`mt-0.5 flex items-center gap-1 text-xs ${MUTED}`}>
            {isNew ? <NewPill /> : null}
            {filter === 'all' ? <AppMark app={group.app} size={14} /> : null}
            <span className="truncate">
              {location} ·{' '}
              <time dateTime={new Date(action.occurredAt).toISOString()} className="tabular-nums">
                {timeLabel(action.occurredAt)}
              </time>
            </span>
          </span>
        </span>
      </a>
    </li>
  );
}

/** Several people's doings on one item in one day: a sentence that deals out every doing. */
function SummaryEntry({ group, isNew }: { group: WhatHappenedGroup; isNew: boolean }) {
  const { filter, onHome } = useExplorer();
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const location = useLocation(group);
  const open = useOpen(group);
  // "edited Budget"; "edited and moved Budget". A verb that needs words after the name reads them in the list.
  return (
    <li>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        data-what-happened-group={group.id}
        onClick={() => {
          if (!expanded) onHome?.('Opened', 'Group');
          setExpanded(!expanded);
        }}
        className={`flex w-full items-start gap-3 text-left ${ROW} ${FOCUS_RING}`}
      >
        <AvatarStack people={group.people} size={24} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-slate-700 dark:text-slate-300">
            <strong className={STRONG}>{peopleList(group.people)}</strong> {verbList(group.verbs)}{' '}
            <ItemName group={group} />
          </span>
          <span className={`mt-0.5 flex items-center gap-1 text-xs ${MUTED}`}>
            {isNew ? <NewPill /> : null}
            {filter === 'all' ? <AppMark app={group.app} size={14} /> : null}
            <span className="truncate">
              {location} · {updatesLabel(group.actions.length)} ·{' '}
              <time dateTime={new Date(group.latestAt).toISOString()} className="tabular-nums">
                {timeLabel(group.latestAt)}
              </time>
            </span>
          </span>
        </span>
        <span
          aria-hidden
          className={`mt-0.5 shrink-0 ${MUTED} motion-safe:transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <ChevronDownIcon />
        </span>
      </button>
      <ul id={listId} hidden={!expanded} className="ml-9 mt-1 flex flex-col gap-0.5">
        {expanded
          ? group.actions.map((action) => {
              const person = group.people.find((p) => p.id === action.actorId);
              const verb = VERB_PHRASES[action.type as WhatHappenedVerb];
              return (
                <li key={action.id}>
                  <a
                    href={open.href}
                    onClick={open.onClick}
                    aria-label={`${personName(action)} ${verb}, ${group.item.title || 'Untitled'}, ${timeLabel(action.occurredAt)}`}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800/70 ${FOCUS_RING}`}
                  >
                    <Avatar person={person} size={20} />
                    <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300">
                      <strong className={STRONG}>{personName(action)}</strong> {verb}
                    </span>
                    <time
                      dateTime={new Date(action.occurredAt).toISOString()}
                      className={`shrink-0 text-xs tabular-nums ${MUTED}`}
                    >
                      {timeLabel(action.occurredAt)}
                    </time>
                  </a>
                </li>
              );
            })
          : null}
      </ul>
    </li>
  );
}
