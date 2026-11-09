'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  CheckIcon,
  isComposingKey,
  SearchIcon,
  TextInput,
  useClickOutside,
} from '@liveworkspace/ui';
import { ChevronIcon } from '../glyphs';
import { settingsApiErrorMessage } from '../store';
import { SETTINGS_ROW_BUTTON, SettingsRowShell } from '../SettingsRowShell';
import { useSavedFlash } from '../useSavedFlash';
import type { Profile, ProfileHost } from './profile-host';
import {
  browserTimeZone,
  filterZones,
  zoneLabel,
  zoneOption,
  zoneOptions,
  type ZoneOption,
} from './time-zones';

// Settings › Profile › Time Zone (liveworkspace/docs/specs/010-site/site.md "Settings", "Profile"): the zone the
// emails that can wait keep to (liveworkspace/docs/specs/003-accounts/accounts.md "The send window"). One button names
// the zone in force; pressed, a searchable list opens in place under the row: Automatic (this browser's zone) first,
// then every zone by offset and city. A pick is saved at once through the host (`{ timeZone }`, null for Automatic),
// and a refused newest write puts back what the server last took, as the colour does. The list is built when first
// asked for (time-zones.ts), warmed while the browser is idle once the row shows, so opening it costs no frame.

export const TIME_ZONE_LABEL = 'Your Time Zone';
export const TIME_ZONE_DESCRIPTION =
  'Emails that can wait arrive in your daytime, weekdays 09:00 to 21:00 here.';

// What the row says while the profile is read, or when the read fails.
type Loaded =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'ready'; profile: Profile | null };

/** The row as the Profile draws it: the profile read when first shown (the same request as Name and Colour), a
 *  placeholder meanwhile, and a note with Try again when the read fails. */
export function TimeZoneSection({ host }: { host: ProfileHost }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const load = useRef(host.load);
  useLayoutEffect(() => {
    load.current = host.load;
  });
  useEffect(() => {
    let live = true;
    void load.current().then(
      (result) => {
        if (!live) return;
        setLoaded(
          result.ok
            ? { state: 'ready', profile: result.data }
            : { state: 'error', error: result.error },
        );
      },
      () => live && setLoaded({ state: 'error', error: 'offline' }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  const message = host.errorMessage ?? settingsApiErrorMessage;
  const row = { key: 'timeZone', label: TIME_ZONE_LABEL, description: TIME_ZONE_DESCRIPTION };

  if (loaded.state === 'ready') return <TimeZoneRow initial={loaded.profile} host={host} />;
  if (loaded.state === 'loading') {
    return (
      <SettingsRowShell
        row={row}
        control={
          <span
            aria-busy
            aria-label="Loading your time zone"
            className="block h-7 w-40 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70"
          />
        }
      />
    );
  }
  return (
    <SettingsRowShell
      row={row}
      control={
        <button
          type="button"
          className={SETTINGS_ROW_BUTTON}
          onClick={() => {
            setLoaded({ state: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          Try Again
        </button>
      }
    >
      <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">
        {message(loaded.error)}
      </p>
    </SettingsRowShell>
  );
}

type Zone = { zone: string | null; auto: boolean };

// The button's words: the zone in force as its city and offset; Automatic names the zone it follows.
function shownLabel({ zone, auto }: Zone, detected: string | null): string {
  if (!auto) return zone ? zoneLabel(zone) : 'Automatic';
  const followed = detected ?? zone;
  return followed ? `Automatic: ${zoneLabel(followed)}` : 'Automatic';
}

// Builds the full list while the browser is idle, once per page, so the first opening has nothing to make.
function warmWhenIdle(also: readonly (string | null)[]): () => void {
  if (typeof window === 'undefined') return () => {};
  const warm = () => void zoneOptions(also);
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(warm, { timeout: 2_000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(warm, 200);
  return () => window.clearTimeout(id);
}

/** The row over a profile already read. */
export function TimeZoneRow({ initial, host }: { initial: Profile | null; host: ProfileHost }) {
  const message = host.errorMessage ?? settingsApiErrorMessage;
  const detected = useMemo(() => browserTimeZone(), []);
  const [current, setCurrent] = useState<Zone>({
    zone: initial?.timeZone ?? null,
    auto: initial?.timeZoneAuto ?? true,
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, flashSaved] = useSavedFlash();
  // Which write is the newest, and what the server last took (newest answered OK wins), for a refusal to put back.
  const turn = useRef(0);
  const taken = useRef<{ turn: number; value: Zone }>({ turn: 0, value: current });
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const textId = useId();

  useEffect(() => warmWhenIdle([initial?.timeZone ?? null, detected]), [initial, detected]);
  useClickOutside(wrapper, () => setOpen(false), open);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  async function pick(next: string | null) {
    close(true);
    if (next === null ? current.auto : !current.auto && next === current.zone) return;
    const mine = ++turn.current;
    const shown: Zone =
      next === null ? { zone: detected ?? current.zone, auto: true } : { zone: next, auto: false };
    setCurrent(shown);
    setError(null);
    const result = await host.save({ timeZone: next });
    if (result.ok && mine > taken.current.turn) {
      const answered: Zone = {
        zone: result.data?.timeZone !== undefined ? result.data.timeZone : shown.zone,
        auto: result.data?.timeZoneAuto ?? shown.auto,
      };
      taken.current = { turn: mine, value: answered };
    }
    if (mine !== turn.current) return;
    if (result.ok) {
      setCurrent(taken.current.value);
      flashSaved();
    } else {
      setCurrent(taken.current.value);
      setError(result.error);
    }
  }

  const label = shownLabel(current, detected);

  return (
    <div ref={wrapper} className="rounded-[inherit]" data-time-zone-row="">
      <SettingsRowShell
        row={{ key: 'timeZone', label: TIME_ZONE_LABEL, description: TIME_ZONE_DESCRIPTION }}
        control={
          <>
            <span
              aria-live="polite"
              className={`text-xs font-medium text-emerald-700 transition-opacity duration-micro motion-reduce:transition-none dark:text-emerald-400 ${
                saved ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {saved ? 'Saved' : ''}
            </span>
            <button
              ref={button}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-labelledby={`timeZone-label ${textId}`}
              onClick={() => setOpen((o) => !o)}
              className={`${SETTINGS_ROW_BUTTON} inline-flex max-w-[15rem] items-center gap-1.5`}
            >
              <span id={textId} className="min-w-0 truncate">
                {label}
              </span>
              <ChevronIcon open={open} className="text-slate-400" />
            </button>
          </>
        }
      >
        {open ? (
          <ZoneList
            id={listId}
            current={current}
            detected={detected}
            onPick={(next) => void pick(next)}
            onClose={() => close(true)}
            onLeave={() => close(false)}
          />
        ) : null}
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {message(error)}
          </p>
        ) : null}
      </SettingsRowShell>
    </div>
  );
}

// One entry of the list: Automatic (null) or a zone.
type Entry = { key: string; value: string | null; option: ZoneOption | null };

const AUTOMATIC_WORDS = 'automatic browser this device';

// The search field and the list under it, a combobox: the field keeps focus, arrow keys move the active entry,
// Enter picks it, Escape closes and gives focus back to the button.
function ZoneList({
  id,
  current,
  detected,
  onPick,
  onClose,
  onLeave,
}: {
  id: string;
  current: Zone;
  detected: string | null;
  onPick: (next: string | null) => void;
  onClose: () => void;
  // Focus went on to another control (Tab): the list closes where it is, focus staying where it went.
  onLeave: () => void;
}) {
  const [query, setQuery] = useState('');
  // Built (or taken from the page's cache) as the list opens, never before.
  const zones = useMemo(() => zoneOptions([current.zone, detected]), [current.zone, detected]);
  const followed = detected ? zoneOption(detected) : null;
  const entries = useMemo<Entry[]>(() => {
    const words = query.trim().toLowerCase();
    const automatic =
      !words ||
      words
        .split(/\s+/)
        .every((w) => AUTOMATIC_WORDS.includes(w) || followed?.haystack.includes(w));
    return [
      ...(automatic ? [{ key: 'automatic', value: null, option: followed }] : []),
      ...filterZones(zones, query).map((option) => ({ key: option.id, value: option.id, option })),
    ];
  }, [query, zones, followed]);
  const selectedKey = current.auto ? 'automatic' : current.zone;
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      entries.findIndex((entry) => entry.key === selectedKey),
    ),
  );
  const list = useRef<HTMLUListElement>(null);
  const optionId = (index: number) => `${id}-option-${index}`;
  const activeIndex = Math.min(active, Math.max(0, entries.length - 1));

  // The active entry stays in sight as the keys move it (and the one in force as the list opens).
  useLayoutEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter, Escape and the arrows confirm, drop or move through an input method's word first (design-principles.md).
    if (isComposingKey(event)) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (entries.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((activeIndex + step + entries.length) % entries.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = entries[activeIndex];
      if (entry) onPick(entry.value);
    } else if (event.key === 'Escape') {
      // The list's alone: the panel stays open behind it.
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <div
      data-time-zone-list=""
      className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      <div className="relative">
        <SearchIcon
          aria-hidden
          size={14}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
        />
        <TextInput
          autoFocus
          compact
          role="combobox"
          aria-label="Search time zones"
          aria-expanded
          aria-controls={id}
          aria-autocomplete="list"
          aria-activedescendant={entries.length ? optionId(activeIndex) : undefined}
          placeholder="Search by city, region or offset"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          // A press on an entry keeps the field focused (claimed below), so only focus taken by another control
          // lands here; focus leaving the window (no new target) keeps the list for the person's return.
          onBlur={(event) => {
            const next = event.relatedTarget;
            if (
              next instanceof Node &&
              !event.currentTarget.closest('[data-time-zone-list]')?.contains(next)
            )
              onLeave();
          }}
          className="pl-8"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <ul
        ref={list}
        id={id}
        role="listbox"
        aria-label="Time zones"
        className="mt-1.5 max-h-72 overflow-y-auto overscroll-contain"
      >
        {entries.map((entry, index) => {
          const checked = entry.key === selectedKey;
          const isActive = index === activeIndex;
          // The field keeps focus (the press is claimed), so a press never closes the list before the click picks.
          return (
            <li
              key={entry.key}
              id={optionId(index)}
              data-index={index}
              role="option"
              aria-selected={checked}
              onMouseDown={(event) => event.preventDefault()}
              onPointerMove={() => {
                if (!isActive) setActive(index);
              }}
              onClick={() => onPick(entry.value)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors duration-micro ${
                checked
                  ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                  : 'text-slate-700 dark:text-slate-200'
              } ${isActive ? (checked ? 'ring-1 ring-brand-300 ring-inset dark:ring-brand-500/50' : 'bg-slate-100 dark:bg-slate-800') : ''}`}
            >
              <span className="flex size-4 shrink-0 items-center justify-center">
                {checked ? (
                  <CheckIcon aria-hidden size={14} className="text-brand-600 dark:text-brand-300" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {entry.value === null ? 'Automatic' : (entry.option?.city ?? entry.value)}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {entry.value === null
                    ? followed
                      ? `Follows this browser: ${followed.city}`
                      : 'Follows this browser'
                    : entry.option?.region || entry.value}
                </span>
              </span>
              {entry.option ? (
                <span className="shrink-0 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {entry.option.offset}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {entries.length === 0 ? (
        <p className="px-2.5 py-3 text-sm text-slate-500 dark:text-slate-400">
          No time zone matches “{query.trim()}”.
        </p>
      ) : null}
    </div>
  );
}
