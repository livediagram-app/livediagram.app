'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { avatarFill, initials } from '@liveworkspace/account-menu/initials';
import {
  cleanProfileName,
  PRESENCE_COLOURS,
  PROFILE_NAME_MAX,
} from '@liveworkspace/settings/presence';
import { PictureDisc, SwitchRow } from '@liveworkspace/ui';
import { settingsApiErrorMessage } from '../store';
import { useSavedFlash } from '../useSavedFlash';
import { colourLabel } from './ProfileHeader';
import type { Profile, ProfileHost } from './profile-host';

// Settings › Profile › Name and Colour (liveworkspace/docs/site.md "Settings", "Profile"), the one editor every host
// draws in place: a preview of what collaborators see, the display name (saved once typing pauses, when the field is
// left, or as the page goes) and the presence colour (saved at once, put back if the write fails). The host loads and
// saves (ProfileHost); nothing here links away.

/** How long typing must pause before the name is saved. */
export const NAME_SAVE_DELAY_MS = 800;

/** The panel's text field, as the Profile's name uses it. */
export const SETTINGS_INPUT =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-white dark:focus:ring-white/10';

// A runtime colour under white text: the colour itself in light, its deep shade in dark, from the custom properties
// presenceVars sets.
const IDENTITY_FILL = 'bg-(--identity) dark:bg-(--identity-deep)';

// The two shades IDENTITY_FILL reads: a palette colour's own dark shade, or a custom one darkened until white reads
// (the account menu's avatarFill).
function presenceVars(color: string): CSSProperties {
  return { '--identity': color, '--identity-deep': avatarFill('', color) } as CSSProperties;
}
// The fill for no colour of their own: slate, as the header's avatar is.
const AUTOMATIC_FILL =
  'bg-gradient-to-br from-slate-600 to-slate-900 dark:from-slate-300 dark:to-slate-500';
// "Automatic" as a swatch: every colour an app might pick, round the wheel.
const AUTOMATIC_SWATCH: CSSProperties = {
  background: `conic-gradient(${PRESENCE_COLOURS.map((c) => c.value).join(', ')}, ${PRESENCE_COLOURS[0]!.value})`,
};

type NameStatus = 'idle' | 'saving' | 'saved' | 'error';

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
    >
      {children}
    </p>
  );
}

/** The editor over a profile already read. */
export function ProfileEditor({ initial, host }: { initial: Profile | null; host: ProfileHost }) {
  const { accountName } = host;
  const message = host.errorMessage ?? settingsApiErrorMessage;
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<string | null>(initial?.color ?? null);
  const [nameStatus, setNameStatus] = useState<NameStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [colourSaved, flashColourSaved] = useSavedFlash();
  // Show My Google Picture, for an account with one: saved at once, put back if the write fails.
  const googlePicture = initial?.googlePicture ?? null;
  const [showPicture, setShowPicture] = useState(initial?.showPicture ?? true);
  const [pictureSaved, flashPictureSaved] = useSavedFlash();
  const pictureTurn = useRef(0);
  const nameId = useId();
  const hintId = useId();

  // The name as last stored, the one waiting to be, and which write is the newest.
  const stored = useRef<string | null>(cleanProfileName(initial?.name ?? ''));
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turn = useRef(0);
  const colourTurn = useRef(0);
  // The host as it is now, for the page's leaving (registered once).
  const hostRef = useRef(host);
  useLayoutEffect(() => {
    hostRef.current = host;
  });

  async function saveName(value: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    const clean = cleanProfileName(value);
    if (clean === stored.current) {
      setNameStatus((s) => (s === 'saving' ? 'saved' : s));
      return;
    }
    const mine = ++turn.current;
    setNameStatus('saving');
    setError(null);
    const result = await host.save({ name: clean });
    if (result.ok) stored.current = clean;
    if (mine !== turn.current) return;
    if (result.ok) setNameStatus('saved');
    else {
      setNameStatus('error');
      setError(result.error);
    }
  }

  function typed(value: string) {
    setName(value);
    setNameStatus('idle');
    pending.current = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveName(value), NAME_SAVE_DELAY_MS);
  }

  // A name still waiting when the page goes (or the panel closes) is sent on the way out, so nothing typed is lost.
  useEffect(() => {
    const leave = () => {
      if (pending.current === null) return;
      const clean = cleanProfileName(pending.current);
      pending.current = null;
      if (clean === stored.current) return;
      hostRef.current.saveOnLeave?.({ name: clean });
    };
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      if (timer.current) clearTimeout(timer.current);
      leave();
    };
  }, []);

  async function pick(next: string | null) {
    if (next === color) return;
    const previous = color;
    const mine = ++colourTurn.current;
    setColor(next);
    // The host's own avatar takes it at once too, and is put back with the editor when the write fails.
    host.onColour?.(next);
    setError(null);
    const result = await host.save({ color: next });
    if (mine !== colourTurn.current) return;
    if (result.ok) flashColourSaved();
    else {
      setColor(previous);
      host.onColour?.(previous);
      setError(result.error);
    }
  }

  async function switchPicture(next: boolean) {
    const mine = ++pictureTurn.current;
    setShowPicture(next);
    setError(null);
    const result = await host.save({ showPicture: next });
    if (mine !== pictureTurn.current) return;
    if (result.ok) flashPictureSaved();
    else {
      setShowPicture(!next);
      setError(result.error);
    }
  }

  const shown = cleanProfileName(name) ?? (accountName || 'You');

  return (
    <div
      data-profile-editor=""
      className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_15rem] md:items-start"
    >
      <div className="min-w-0 space-y-6">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={nameId} className="text-sm font-medium text-slate-900 dark:text-white">
              Display name
            </label>
            <NameStatusNote status={nameStatus} />
          </div>
          <input
            id={nameId}
            aria-describedby={hintId}
            className={`${SETTINGS_INPUT} mt-2`}
            autoComplete="name"
            maxLength={PROFILE_NAME_MAX}
            placeholder={accountName || 'Your name'}
            value={name}
            onChange={(event) => typed(event.target.value)}
            onBlur={() => {
              if (pending.current !== null) void saveName(pending.current);
            }}
          />
          <p id={hintId} className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Leave it empty to show the name you signed up with.
          </p>
        </div>

        <ColourPicker color={color} onPick={(next) => void pick(next)} saved={colourSaved} />
        {googlePicture && (
          <PictureSwitch
            checked={showPicture}
            onChange={(next) => void switchPicture(next)}
            saved={pictureSaved}
          />
        )}
        {error && <ErrorNote>{message(error)}</ErrorNote>}
      </div>

      <Preview name={shown} color={color} picture={showPicture ? googlePicture : null} />
    </div>
  );
}

/** The editor as the Profile's row draws it: the profile read when the row is first shown (one request), a skeleton
 *  meanwhile, and a note with Try again when the read fails. */
export function ProfileSection({ host }: { host: ProfileHost }) {
  const [state, setState] = useState<
    | { state: 'loading' }
    | { state: 'error'; error: string }
    | { state: 'ready'; profile: Profile | null }
  >({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ state: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  // Read once per showing (and per Try again), not when the host's other callbacks change.
  const load = useRef(host.load);
  useLayoutEffect(() => {
    load.current = host.load;
  });
  useEffect(() => {
    let live = true;
    void load.current().then(
      (result) => {
        if (!live) return;
        setState(
          result.ok
            ? { state: 'ready', profile: result.data }
            : { state: 'error', error: result.error },
        );
      },
      () => live && setState({ state: 'error', error: 'offline' }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  const message = host.errorMessage ?? settingsApiErrorMessage;
  return (
    <div data-settings-cell="profile" className="px-4 py-4">
      {state.state === 'loading' ? (
        <div
          aria-busy
          aria-label="Loading your profile"
          className="h-40 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70"
        />
      ) : state.state === 'error' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            {message(state.error)}
          </p>
          <button
            type="button"
            onClick={retry}
            className="relative touch-target inline-flex cursor-pointer items-center rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors duration-micro hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Try again
          </button>
        </div>
      ) : (
        <ProfileEditor initial={state.profile} host={host} />
      )}
    </div>
  );
}

function NameStatusNote({ status }: { status: NameStatus }) {
  const text = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : '';
  return (
    <span
      aria-live="polite"
      className={`text-xs font-medium transition-opacity duration-micro motion-reduce:transition-none ${
        status === 'saved'
          ? 'text-emerald-700 dark:text-emerald-400'
          : 'text-slate-500 dark:text-slate-400'
      } ${text ? 'opacity-100' : 'opacity-0'}`}
    >
      {text}
    </span>
  );
}

function CheckGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 drop-shadow-[0_1px_1px_rgb(0_0_0/0.35)]"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// The palette as a radio group: Automatic, then each colour. Arrow keys move and pick, as a radio group does; Tab
// leaves it.
function ColourPicker({
  color,
  onPick,
  saved,
}: {
  color: string | null;
  onPick: (next: string | null) => void;
  saved: boolean;
}) {
  const labelId = useId();
  const options: (string | null)[] = [null, ...PRESENCE_COLOURS.map((c) => c.value)];
  const current = color?.toLowerCase() ?? null;
  // A colour set elsewhere that isn't a swatch: no swatch is checked, so the first takes focus.
  const checkedIndex = Math.max(0, options.indexOf(current));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    refs.current[next]?.focus();
    onPick(options[next] ?? null);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p id={labelId} className="text-sm font-medium text-slate-900 dark:text-white">
          Presence colour{' '}
          <span className="font-normal text-slate-500 dark:text-slate-400">
            · {colourLabel(color)}
          </span>
        </p>
        <span
          aria-live="polite"
          className={`text-xs font-medium text-emerald-700 transition-opacity duration-micro motion-reduce:transition-none dark:text-emerald-400 ${
            saved ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {saved ? 'Saved' : ''}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="mt-3 flex flex-wrap gap-x-2.5 gap-y-3"
      >
        {options.map((value, index) => {
          const checked = value === current;
          const label = value === null ? 'Automatic: each app picks one' : colourLabel(value);
          return (
            <button
              key={value ?? 'automatic'}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={label}
              tabIndex={index === checkedIndex ? 0 : -1}
              onClick={() => onPick(value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              style={value === null ? AUTOMATIC_SWATCH : presenceVars(value)}
              className={`relative touch-target flex size-9 cursor-pointer items-center justify-center rounded-full text-white ring-offset-2 ring-offset-white transition-transform duration-micro hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 motion-reduce:transition-none motion-reduce:hover:scale-100 dark:ring-offset-slate-900 ${
                value === null ? '' : IDENTITY_FILL
              } ${checked ? 'ring-2 ring-slate-900 focus-visible:ring-slate-900 dark:ring-white dark:focus-visible:ring-white' : ''}`}
            >
              {checked && <CheckGlyph />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Show My Google Picture (liveworkspace/docs/accounts.md "Profile pictures"): whether others see the account's Google
// picture or its initials. Their own screen shows it either way.
function PictureSwitch({
  checked,
  onChange,
  saved,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  saved: boolean;
}) {
  return (
    <div data-profile-picture-switch="">
      <SwitchRow checked={checked} onChange={onChange} className="py-1">
        <span className="block text-sm font-medium text-slate-900 dark:text-white">
          Show My Google Picture
        </span>
        <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
          {checked
            ? 'People you work with see your Google picture.'
            : 'People you work with see your initials.'}
        </span>
      </SwitchRow>
      <span
        aria-live="polite"
        className={`mt-1 block text-xs font-medium text-emerald-700 transition-opacity duration-micro motion-reduce:transition-none dark:text-emerald-400 ${
          saved ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {saved ? 'Saved' : ''}
      </span>
    </div>
  );
}

// What collaborators see: a cursor with the name beside it, and the avatar in the presence list (their Google picture
// while Show My Google Picture is on).
function Preview({
  name,
  color,
  picture,
}: {
  name: string;
  color: string | null;
  picture: string | null;
}) {
  const fill = color ? IDENTITY_FILL : AUTOMATIC_FILL;
  const style = color ? presenceVars(color) : undefined;
  return (
    <figure className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
      <figcaption className="text-xs font-semibold tracking-[.14em] text-slate-500 uppercase dark:text-slate-400">
        How others see you
      </figcaption>
      <div
        aria-hidden
        className="relative mt-3 h-24 overflow-hidden rounded-xl border border-slate-200 bg-white bg-[radial-gradient(circle,rgb(148_163_184/0.35)_1px,transparent_1px)] bg-[length:14px_14px] dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="absolute top-5 left-8 flex items-start">
          <svg viewBox="0 0 16 16" className="size-5 drop-shadow-sm" style={style}>
            <path
              d="M2 1.5 14 7.2l-5.4 1.4L6 14z"
              className={
                color
                  ? 'fill-(--identity) stroke-white dark:fill-(--identity-deep) dark:stroke-slate-900'
                  : 'fill-slate-700 stroke-white dark:fill-slate-300 dark:stroke-slate-900'
              }
              strokeWidth={1.25}
              strokeLinejoin="round"
            />
          </svg>
          <span
            className={`mt-4 -ml-1 inline-flex h-6 max-w-36 items-center rounded-full px-2.5 text-xs font-semibold shadow-sm ${fill} ${color ? 'text-white' : 'text-white dark:text-slate-950'}`}
            style={style}
          >
            <span className="text-optical-centre min-w-0 truncate">{name}</span>
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <PictureDisc
          aria-hidden
          pictureUrl={picture}
          name={name}
          size={36}
          className={`flex text-xs font-semibold text-white ring-2 ring-white dark:ring-slate-900 ${fill} ${color ? '' : 'dark:text-slate-950'}`}
          style={style}
        >
          {initials(name)}
        </PictureDisc>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
            {name}
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {color ? 'Your colour in every app' : 'Each app picks your colour'}
          </span>
        </span>
      </div>
    </figure>
  );
}
