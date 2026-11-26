'use client';

// The Start a Call popover (liveworkspace/docs/specs/004-index/item-calls.md "The Start a Call popover", Work Tracker
// 1470): Call asks where to meet before anything starts. Under Call from `sm` up, a sheet on a phone (and from the Apps
// drawer's tile, which has no Call to sit under). Share's look: the hero band (the meeting art), the shared buttons.
// One choice, A New Space or one of the person's Spaces, preselected from Settings › Calls and changed for this call
// alone; Start Call opens the call's tab in its own press, Cancel (Escape, a press outside) starts nothing.
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { readCallSpaceSetting, type Item } from '@liveworkspace/index-client';
import { Button, Dialog, ResponsivePopover, lucideGlyph } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { meetingHeroArt } from '@liveworkspace/ui/dialog-hero-art/meeting';
import { lucidePlus, lucideSearch, lucideVideo } from '@liveworkspace/icons/lucide';
import {
  choosableSpaces,
  isUnavailable,
  matchesSpace,
  useSpacePreviews,
} from '@liveworkspace/settings-ui/call-spaces';
import { APP_ITEMS, siteOfApp, siteUrlHere } from '@liveworkspace/sites';
import { workbench } from '../../bindings';
import { closeCallChooser, useCallChooser } from './call-chooser-store';
import { listCallSpaces } from './call-spaces-read';
import { useItemCalls, type CallSource } from './item-call-store';
import { useStartCall } from './useItemCallAction';

const PlusGlyph = lucideGlyph(lucidePlus, 16);
const SearchGlyph = lucideGlyph(lucideSearch, 14);
const VideoGlyph = lucideGlyph(lucideVideo, 16);
const SmallVideoGlyph = lucideGlyph(lucideVideo, 14);

// A search field once there are more Spaces than fit at a glance (Settings › Calls' threshold).
export const SEARCH_FROM = 7;
// The popover's width from `sm` up.
const WIDTH = 400;

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; spaces: Item[] };

const NONE: readonly Item[] = [];

// The last list this page read, shown at once on the next open while it is read again behind it.
let kept: Item[] | null = null;

/** Forgets the kept list (tests). */
export const forgetKeptSpaces = () => {
  kept = null;
};

const token = () => workbench.api.currentBearer();

// One row of the choice: a native radio under the whole row, so the arrow keys move between rows and Space picks.
const ROW =
  'group relative flex cursor-pointer items-center gap-3 rounded-xl border p-2 pr-3 text-left transition-[border-color,background-color,box-shadow] duration-micro has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-white dark:has-[:focus-visible]:ring-offset-slate-900';
const ROW_IDLE =
  'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/70';
const ROW_ON =
  'border-brand-600 bg-brand-50/70 ring-1 ring-brand-600 dark:border-brand-400 dark:bg-brand-950/40 dark:ring-brand-400';
const THUMB =
  'relative flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md';
const SECTION_LABEL =
  'text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-400';

function Row({
  checked,
  onSelect,
  label,
  picture,
  name,
  detail,
  badge,
  rowId,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  picture: ReactNode;
  name: ReactNode;
  detail: ReactNode;
  badge?: ReactNode;
  rowId: string;
}) {
  return (
    <label data-start-call-row={rowId} className={`${ROW} ${checked ? ROW_ON : ROW_IDLE}`}>
      <input
        type="radio"
        name="start-call-where"
        className="sr-only"
        checked={checked}
        onChange={onSelect}
        aria-label={label}
      />
      {picture}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
            {name}
          </span>
          {badge}
        </span>
        <span className="block truncate text-xs text-slate-600 dark:text-slate-400">{detail}</span>
      </span>
      {/* The radio as it is seen: a ring, filled with a dot once chosen. */}
      <span
        aria-hidden
        className={`flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-micro ${
          checked
            ? 'border-brand-600 dark:border-brand-400'
            : 'border-slate-300 group-hover:border-slate-400 dark:border-slate-600 dark:group-hover:border-slate-500'
        }`}
      >
        {checked ? <span className="size-2 rounded-full bg-brand-600 dark:bg-brand-400" /> : null}
      </span>
    </label>
  );
}

// Marks the row Settings › Calls chose: "Default" on A New Space, "Your Calls Space" on a chosen Space.
function SettingBadge({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-px text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
      {children}
    </span>
  );
}

/** The popover for the open item; nothing once the item can't start a call. */
export function StartCallPopover({ anchor }: { anchor: HTMLElement | null }) {
  const { source } = useItemCalls();
  if (!source?.canStart) return null;
  return <StartCallChooser source={source} anchor={anchor} />;
}

function StartCallChooser({ source, anchor }: { source: CallSource; anchor: HTMLElement | null }) {
  const titleId = useId();
  const whereId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const { starting } = useCallChooser();
  const start = useStartCall();
  // The person's Calls Open In as it stands now (null: A New Space for Each Call).
  const setting = useMemo(() => readCallSpaceSetting(workbench.readPreferences()), []);
  const [load, setLoad] = useState<Load>(() =>
    kept ? { state: 'ready', spaces: kept } : { state: 'loading' },
  );
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  // The choice for this call: undefined until the person picks (the setting's, as the list allows), null for A New
  // Space. Never written back to the setting.
  const [picked, setPicked] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    listCallSpaces().then(
      (items) => {
        if (!live) return;
        kept = choosableSpaces(items);
        setLoad({ state: 'ready', spaces: kept });
      },
      () => {
        // A kept list stands; with none, the error and Try Again.
        if (live && !kept) setLoad({ state: 'error' });
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const spaces = load.state === 'ready' ? load.spaces : NONE;
  const unavailable = load.state === 'ready' && isUnavailable(setting, spaces);
  // Preselected: the setting's Space, unless it can't be used (A New Space then).
  const preset = unavailable ? null : setting;
  const chosen = picked === undefined ? preset : picked;
  // The setting's Space first, so the preselected row opens in view however long the list is.
  const ordered = useMemo(
    () =>
      setting === null
        ? spaces
        : [...spaces.filter((s) => s.id === setting), ...spaces.filter((s) => s.id !== setting)],
    [spaces, setting],
  );
  // Find a Space narrows the list but keeps the chosen row, so Start Call never starts somewhere out of sight.
  const found = useMemo(() => ordered.some((s) => matchesSpace(s, query)), [ordered, query]);
  const matching = useMemo(
    () => ordered.filter((s) => s.id === chosen || matchesSpace(s, query)),
    [ordered, query, chosen],
  );
  // The setting's Space while the list loads or can't (or past the listed): chosen, with no name to show.
  const settingRow =
    setting !== null && !unavailable && !spaces.some((s) => s.id === setting) ? (
      <Row
        rowId="setting"
        checked={chosen === setting}
        onSelect={() => setPicked(setting)}
        label="Your Calls Space"
        picture={
          <span
            aria-hidden
            className={`${THUMB} bg-gradient-to-br from-emerald-50 to-cyan-50 text-emerald-700 dark:from-emerald-950/50 dark:to-cyan-950/40 dark:text-emerald-300`}
          >
            <SmallVideoGlyph />
          </span>
        }
        name="Your Calls Space"
        detail="The Space you chose in Settings › Calls"
        badge={<SettingBadge>Your Calls Space</SettingBadge>}
      />
    ) : null;
  const { previews, watch } = useSpacePreviews(matching, token);

  // Focus the chosen row on open, so the arrows move the choice and Enter starts. A touch screen keeps the sheet's own.
  useEffect(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
      return;
    const frame = requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLInputElement>('input[type="radio"]:checked')
        ?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (starting) return;
    // In the press: startCall opens the call's tab before it awaits anything (pop-up blockers).
    start(source, chosen);
    closeCallChooser();
  };

  const noun = APP_ITEMS[source.app].noun.toLowerCase();
  const livehuddle = siteUrlHere(siteOfApp('livehuddle'));

  const body = (
    <form
      ref={formRef}
      onSubmit={submit}
      data-start-call=""
      className="flex min-h-0 flex-1 flex-col"
    >
      <HeroDialogHeader
        art={meetingHeroArt}
        titleId={titleId}
        title="Start a Call"
        subtitle={
          <>
            About <bdi>{source.title.trim() || `Untitled ${noun}`}</bdi>
          </>
        }
        onClose={closeCallChooser}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-4 pb-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={whereId} className={SECTION_LABEL}>
            Where to Meet
          </h3>
          {spaces.length >= SEARCH_FROM ? (
            <label className="relative w-full">
              <span className="sr-only">Find a Space</span>
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-500 dark:text-slate-400"
              >
                <SearchGlyph />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a Space"
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-2.5 pl-8 text-sm text-slate-900 placeholder:text-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400"
              />
            </label>
          ) : null}
        </div>
        {unavailable ? (
          <Callout tone="warning" role="status">
            Your Calls Space isn’t available, so a new Space is chosen.
          </Callout>
        ) : null}
        <div
          role="radiogroup"
          aria-labelledby={whereId}
          className="-mx-1 flex max-h-[min(20rem,45vh)] flex-col gap-2 overflow-y-auto px-1 py-0.5"
          data-start-call-list=""
        >
          <Row
            rowId="new"
            checked={chosen === null}
            onSelect={() => setPicked(null)}
            label="A New Space"
            picture={
              <span
                aria-hidden
                className={`${THUMB} bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200`}
              >
                <PlusGlyph />
              </span>
            }
            name="A New Space"
            detail={`Made for this call, named after the ${noun}`}
            badge={setting === null ? <SettingBadge>Default</SettingBadge> : null}
          />
          {settingRow}
          {load.state === 'loading'
            ? [0, 1].map((n) => (
                <span
                  key={n}
                  aria-hidden
                  data-start-call-loading=""
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 dark:border-slate-700"
                >
                  <span className="h-9 w-14 animate-pulse rounded-md bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
                  <span className="h-3 w-32 animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
                </span>
              ))
            : null}
          {load.state === 'ready'
            ? matching.map((space) => (
                <Row
                  key={space.id}
                  rowId={space.id}
                  checked={chosen === space.id}
                  onSelect={() => setPicked(space.id)}
                  label={space.title || 'Untitled'}
                  picture={
                    <span
                      ref={watch(space.id)}
                      aria-hidden
                      className={`${THUMB} bg-gradient-to-br from-emerald-50 to-cyan-50 text-emerald-700/70 dark:from-emerald-950/50 dark:to-cyan-950/40 dark:text-emerald-300/60`}
                    >
                      {previews.get(space.id) ? (
                        <img
                          src={previews.get(space.id)}
                          alt=""
                          className="size-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <SmallVideoGlyph />
                      )}
                    </span>
                  }
                  name={<bdi>{space.title || 'Untitled'}</bdi>}
                  detail={space.teamId ? 'Team Space' : 'Your Space'}
                  badge={
                    space.id === setting ? <SettingBadge>Your Calls Space</SettingBadge> : null
                  }
                />
              ))
            : null}
        </div>
        {load.state === 'error' ? (
          <Callout
            tone="error"
            role="alert"
            action={{
              label: 'Try Again',
              onSelect: () => {
                setLoad({ state: 'loading' });
                setAttempt((n) => n + 1);
              },
            }}
          >
            Your Spaces couldn’t be loaded.
          </Callout>
        ) : null}
        {load.state === 'ready' && spaces.length === 0 ? (
          <p data-start-call-empty="" className="text-xs text-slate-600 dark:text-slate-400">
            <a
              href={livehuddle}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
            >
              Make a Space in livehuddle
            </a>{' '}
            to meet in it.
          </p>
        ) : null}
        {load.state === 'ready' && spaces.length > 0 && !found ? (
          <p className="text-xs text-slate-600 dark:text-slate-400">No Space is called that.</p>
        ) : null}
        <p className="text-xs text-slate-600 dark:text-slate-400" data-start-call-note="">
          For this call only. Change where calls open in Settings › Calls.
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 sm:px-5 dark:border-slate-800">
        <Button variant="secondary" size="sm" onClick={closeCallChooser}>
          Cancel
        </Button>
        <Button type="submit" size="sm" busy={starting} data-start-call-go="">
          <VideoGlyph aria-hidden />
          {starting ? 'Starting' : 'Start Call'}
        </Button>
      </div>
    </form>
  );

  // Under Call (a sheet on a phone); with nothing to sit under, the shared Dialog: a sheet on a phone, centred above.
  return anchor ? (
    <ResponsivePopover
      open
      onClose={closeCallChooser}
      anchor={anchor}
      titleId={titleId}
      width={WIDTH}
      align="end"
      bare
    >
      {body}
    </ResponsivePopover>
  ) : (
    <Dialog open onClose={closeCallChooser} titleId={titleId} size="sm" phoneSheet closeOnBack>
      {body}
    </Dialog>
  );
}
