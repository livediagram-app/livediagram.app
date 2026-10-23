'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { identityDeep, lucideGlyph } from '@livediagram/ui';
import { presenceColour } from '@liveworkspace/settings';
import { lucideCheck } from '@livediagram/icons/lucide';
import { ACCOUNT_API, accountApi } from '@/lib/account-api';
import {
  cleanName,
  colourName,
  NAME_SAVE_DELAY_MS,
  PRESENCE_COLOURS,
  PROFILE_NAME_MAX,
} from '@/lib/account-settings';
import { initials } from '@/lib/initials';
import { useSession } from '@/lib/session';
import { ErrorNote, INPUT } from './AccountShell';
import { settingsErrorMessage, useSavedFlash } from './settings-ui';

const CheckIcon = lucideGlyph(lucideCheck, 16);

// The accounts API's profile (liveworkspace/docs/accounts.md "Profiles"): the display name (its own,
// or the account's name) and the presence colour, null for each app's own pick.
export interface Profile {
  id: string;
  name: string | null;
  color: string | null;
}

// A runtime colour under white text: the colour itself in light, its palette shade in dark, from the
// custom properties presenceVars sets (@livediagram/ui IDENTITY_FILL, written out so this site's
// Tailwind sees it).
const IDENTITY_FILL = 'bg-(--identity) dark:bg-(--identity-deep)';

// The two shades IDENTITY_FILL reads: a palette colour's own dark shade (@liveworkspace/settings), or
// a custom one (set elsewhere) darkened until white reads.
function presenceVars(color: string): CSSProperties {
  return {
    '--identity': color,
    '--identity-deep': presenceColour(color)?.deep ?? identityDeep(color),
  } as CSSProperties;
}
// The fill for no colour of their own: the site's slate, as the header's avatar is.
const AUTOMATIC_FILL =
  'bg-gradient-to-br from-slate-600 to-slate-900 dark:from-slate-300 dark:to-slate-500';
// "Automatic" as a swatch: every colour an app might pick, round the wheel.
const AUTOMATIC_SWATCH: CSSProperties = {
  background: `conic-gradient(${PRESENCE_COLOURS.map((c) => c.value).join(', ')}, ${PRESENCE_COLOURS[0]!.value})`,
};

type NameStatus = 'idle' | 'saving' | 'saved' | 'error';

// The profile: a preview of what collaborators see, the display name (saved once typing pauses, or
// when the field is left), and the presence colour (saved at once, put back if the write fails).
export function ProfileCard({ initial }: { initial: Profile | null }) {
  const session = useSession();
  const accountName = session.state === 'in' ? session.name : '';
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<string | null>(initial?.color ?? null);
  const [nameStatus, setNameStatus] = useState<NameStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [colourSaved, flashColourSaved] = useSavedFlash();
  const nameId = useId();
  const hintId = useId();

  // The name as last stored, the one waiting to be, and which write is the newest.
  const stored = useRef<string | null>(cleanName(initial?.name ?? ''));
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turn = useRef(0);
  const colourTurn = useRef(0);

  async function saveName(value: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    const clean = cleanName(value);
    if (clean === stored.current) {
      setNameStatus((s) => (s === 'saving' ? 'saved' : s));
      return;
    }
    const mine = ++turn.current;
    setNameStatus('saving');
    setError(null);
    const result = await accountApi('/profile', 'PATCH', { name: clean });
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

  // A name still waiting when the page goes is sent on the way out, so nothing typed is lost.
  useEffect(() => {
    const leave = () => {
      if (pending.current === null) return;
      const clean = cleanName(pending.current);
      pending.current = null;
      if (clean === stored.current) return;
      void fetch(`${ACCOUNT_API}/profile`, {
        method: 'PATCH',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: clean }),
      }).catch(() => {});
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
    setError(null);
    const result = await accountApi('/profile', 'PATCH', { color: next });
    if (mine !== colourTurn.current) return;
    if (result.ok) flashColourSaved();
    else {
      setColor(previous);
      setError(result.error);
    }
  }

  const shown = cleanName(name) ?? (accountName || 'You');

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_15rem] md:items-start">
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
            className={`${INPUT} mt-2`}
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
        {error && <ErrorNote>{settingsErrorMessage(error)}</ErrorNote>}
      </div>

      <Preview name={shown} color={color} />
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

// The palette as a radio group: Automatic, then each colour. Arrow keys move and pick, as a radio
// group does; Tab leaves it.
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
            · {colourName(color)}
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
          const label = value === null ? 'Automatic: each app picks one' : colourName(value);
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
              {checked && (
                <CheckIcon aria-hidden className="size-4 drop-shadow-[0_1px_1px_rgb(0_0_0/0.35)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// What collaborators see: a cursor with the name beside it, and the avatar in the presence list.
function Preview({ name, color }: { name: string; color: string | null }) {
  const fill = color ? IDENTITY_FILL : AUTOMATIC_FILL;
  const style = color ? presenceVars(color) : undefined;
  return (
    <figure className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <figcaption className="text-xs font-semibold tracking-[.14em] text-slate-500 uppercase dark:text-slate-400">
        How others see you
      </figcaption>
      <div
        aria-hidden
        className="relative mt-3 h-24 overflow-hidden rounded-xl border border-slate-200 bg-white bg-[radial-gradient(circle,rgb(148_163_184/0.35)_1px,transparent_1px)] bg-[length:14px_14px] dark:border-slate-800 dark:bg-slate-900"
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
        <span
          aria-hidden
          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white dark:ring-slate-900 ${fill} ${color ? '' : 'dark:text-slate-950'}`}
          style={style}
        >
          <span className="text-optical-centre">{initials(name)}</span>
        </span>
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
