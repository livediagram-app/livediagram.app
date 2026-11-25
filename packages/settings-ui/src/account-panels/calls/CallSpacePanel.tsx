'use client';

// Settings › Calls › Calls Open In (liveworkspace/docs/specs/004-index/item-calls.md "Your Calls Space"): where Call
// opens in every app. A new Space for each call (the default), or one of the person's own or their teams' livehuddle
// Spaces, each with its preview. A choice that can't be used any more shows as Unavailable until another is made.
// Drawn in place wherever a signed-in account opens Settings, its own chunk.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Item } from '@liveworkspace/index-client';
import { siteOfApp, siteUrlHere } from '@liveworkspace/sites';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideCheck, lucidePlus, lucideSearch, lucideVideo } from '@liveworkspace/icons/lucide';
import type { CallSpaceChoice } from '../../account-model';
import { ErrorNote, INPUT } from '../account-ui';
import type { CallSpacesHost } from '../host';
import { choosableSpaces, isUnavailable, matchesSpace, useSpacePreviews } from './call-spaces';

const CheckGlyph = /* @__PURE__ */ lucideGlyph(lucideCheck, 12);
const PlusGlyph = /* @__PURE__ */ lucideGlyph(lucidePlus, 18);
const SearchGlyph = /* @__PURE__ */ lucideGlyph(lucideSearch, 14);
const VideoGlyph = /* @__PURE__ */ lucideGlyph(lucideVideo, 18);

// A search field once there are more Spaces than fit at a glance, and this many shown before Show All.
const SEARCH_FROM = 7;
const SHOWN_FIRST = 9;

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; spaces: Item[] };

// One card of the choice: a native radio under the whole card, so arrows move between them and Space picks.
const CARD =
  'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white text-left transition-[border-color,box-shadow] duration-micro has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-white dark:bg-slate-900 dark:has-[:focus-visible]:ring-offset-slate-900';
const CARD_IDLE =
  'border-slate-200 hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:hover:border-slate-600';
const CARD_ON =
  'border-emerald-600 shadow-sm ring-1 ring-emerald-600 dark:border-emerald-400 dark:ring-emerald-400';
const CARD_WARN =
  'border-amber-500 ring-1 ring-amber-500 dark:border-amber-400 dark:ring-amber-400';

function Tick() {
  return (
    <span
      aria-hidden
      className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm dark:bg-emerald-400 dark:text-slate-900"
    >
      <CheckGlyph />
    </span>
  );
}

function Choice({
  checked,
  warn = false,
  onSelect,
  label,
  children,
  className = '',
  testId,
}: {
  checked: boolean;
  warn?: boolean;
  onSelect: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  testId: string;
}) {
  return (
    <label
      data-call-space={testId}
      className={`${CARD} ${checked ? (warn ? CARD_WARN : CARD_ON) : CARD_IDLE} ${className}`}
    >
      <input
        type="radio"
        name="call-space"
        className="sr-only"
        checked={checked}
        onChange={onSelect}
        aria-label={label}
      />
      {children}
      {checked && !warn && <Tick />}
    </label>
  );
}

/** A Space's picture: its preview once it arrives, else a quiet stand-in with the camera. */
function SpacePicture({
  id,
  src,
  watch,
}: {
  id: string;
  src: string | undefined;
  watch: (id: string) => (el: Element | null) => void;
}) {
  return (
    <span
      ref={watch(id)}
      data-preview-for={id}
      className="relative block aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/50 dark:to-cyan-950/40"
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <span
          aria-hidden
          className="flex size-full items-center justify-center text-emerald-600/60 dark:text-emerald-300/50"
        >
          <VideoGlyph />
        </span>
      )}
    </span>
  );
}

export function CallSpacePanel({
  spaces: host,
  value,
  onChange,
}: { spaces: CallSpacesHost } & CallSpaceChoice) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);

  useEffect(() => {
    let live = true;
    setLoad({ state: 'loading' });
    host.list().then(
      (items) => live && setLoad({ state: 'ready', spaces: choosableSpaces(items) }),
      () => live && setLoad({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [host, attempt]);

  const spaces = load.state === 'ready' ? load.spaces : [];
  const matching = useMemo(() => spaces.filter((s) => matchesSpace(s, query)), [spaces, query]);
  // The chosen Space always shows: one changed long ago comes first rather than hiding behind Show All.
  const shown = useMemo(() => {
    if (all || query) return matching;
    const first = matching.slice(0, SHOWN_FIRST);
    const lifted = value === null ? undefined : matching.find((s) => s.id === value);
    return lifted && !first.includes(lifted) ? [lifted, ...first.slice(0, SHOWN_FIRST - 1)] : first;
  }, [all, query, matching, value]);
  const { previews, watch } = useSpacePreviews(shown, host.token);
  const pick = useCallback((space: string | null) => onChange(space), [onChange]);

  const intro = (
    <p className="text-sm text-slate-600 dark:text-slate-400">
      Call, at the top right of every app, starts a livehuddle call about what you have open, in a
      new tab. Choose where those calls happen.
    </p>
  );

  if (load.state === 'loading') {
    return (
      <div className="space-y-4">
        {intro}
        <div
          aria-busy
          className="h-48 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70"
        />
      </div>
    );
  }
  if (load.state === 'error') {
    return (
      <div className="space-y-4">
        {intro}
        <ErrorNote action={{ label: 'Try Again', onSelect: () => setAttempt((n) => n + 1) }}>
          Your Spaces couldn’t be loaded. Call keeps opening where you chose.
        </ErrorNote>
      </div>
    );
  }

  const unavailable = isUnavailable(value, spaces);
  const chosen = value !== null && !unavailable ? value : null;
  const livehuddle = siteUrlHere(siteOfApp('livehuddle'));

  return (
    <div className="space-y-5" data-call-spaces="">
      {intro}
      <div role="radiogroup" aria-label="Calls Open In" className="space-y-5">
        <Choice
          checked={value === null}
          onSelect={() => pick(null)}
          label="A New Space for Each Call"
          testId="default"
          className="flex-row items-center gap-3 p-3 pr-10"
        >
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white"
          >
            <PlusGlyph />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-900 dark:text-white">
              A New Space for Each Call
            </span>
            <span className="block text-xs text-slate-600 dark:text-slate-400">
              Default. Each item gets a Space of its own, named after it.
            </span>
          </span>
        </Choice>

        {unavailable && (
          <Choice
            checked
            warn
            onSelect={() => undefined}
            label="Unavailable Space"
            testId="unavailable"
            className="flex-row items-start gap-3 p-3"
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            >
              <VideoGlyph />
            </span>
            <span className="min-w-0" role="status">
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                Unavailable
              </span>
              <span className="block text-xs text-slate-700 dark:text-slate-300">
                The Space you chose was deleted, or you can no longer use it, so each call gets a
                new Space for now. Choose another below, or pick the default above.
              </span>
            </span>
          </Choice>
        )}

        <section aria-labelledby="call-spaces-yours" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              id="call-spaces-yours"
              className="text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-400"
            >
              Your Spaces
            </h3>
            {spaces.length >= SEARCH_FROM && (
              <label className="relative w-full sm:w-56">
                <span className="sr-only">Find a Space</span>
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                >
                  <SearchGlyph />
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a Space"
                  className={`${INPUT} pl-8`}
                />
              </label>
            )}
          </div>

          {spaces.length === 0 ? (
            <p
              data-call-spaces-empty=""
              className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400"
            >
              You have no livehuddle Spaces of your own yet.{' '}
              <a
                href={livehuddle}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
              >
                Make one in livehuddle
              </a>
              , then choose it here.
            </p>
          ) : matching.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No Space is called that.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shown.map((space) => (
                <li key={space.id} className="min-w-0">
                  <Choice
                    checked={chosen === space.id}
                    onSelect={() => pick(space.id)}
                    label={space.title || 'Untitled'}
                    testId={space.id}
                    className="h-full"
                  >
                    <SpacePicture id={space.id} src={previews.get(space.id)} watch={watch} />
                    <span className="block min-w-0 px-3 py-2">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                        <bdi>{space.title || 'Untitled'}</bdi>
                      </span>
                      <span className="block text-xs text-slate-600 dark:text-slate-400">
                        {space.teamId ? 'Team Space' : 'Your Space'}
                      </span>
                    </span>
                  </Choice>
                </li>
              ))}
            </ul>
          )}
          {!all && !query && matching.length > SHOWN_FIRST && (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="cursor-pointer text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
            >
              Show All {matching.length} Spaces
            </button>
          )}
        </section>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-400" data-call-spaces-access="">
        Listed are the Spaces you or your teams own. People who join a call from an item get into
        the Space through a call link that stops working a week after your latest call there; you
        can stop it sooner from the Space’s Share.
      </p>
    </div>
  );
}
