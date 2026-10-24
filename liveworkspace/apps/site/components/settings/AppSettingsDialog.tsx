'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { lucideGlyph } from '@livediagram/ui';
import { lucideExternalLink, lucideX } from '@livediagram/icons/lucide';
import {
  readChoiceValue,
  readSliderValue,
  readToggleValue,
  storedPatch,
  type AppCatalogue,
  type CatalogueBinding,
  type CatalogueChoice,
  type CatalogueRow,
  type CatalogueSlider,
  type StoredValue,
  type ToggleBinding,
} from '@liveworkspace/settings/catalogue';
import { joinSettings } from '@liveworkspace/settings';
import {
  loadAppScopes,
  loadCatalogue,
  patchAppScope,
  rememberAppScopes,
  sectionRuns,
  visibleRows,
  type AppId,
  type AppScopes,
} from '@/lib/app-settings';
import type { ListedApp } from '@/lib/apps';
import { reportAppSetting } from '@/lib/settings-telemetry';
import { AppMark } from '../landing/AppLogo';
import { ErrorNote } from './AccountShell';
import { settingsErrorMessage, useSavedFlash } from './settings-ui';
import { Switch } from './SettingsPanel';

const CloseIcon = lucideGlyph(lucideX, 18);
const OutIcon = lucideGlyph(lucideExternalLink, 14);

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// How long a slider rests before its value is saved.
const SLIDER_SAVE_DELAY_MS = 300;

type Load =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'ready'; catalogue: AppCatalogue };

// One app's own settings, in a dialog over the settings page (liveworkspace/docs/site.md "Your
// account"): the settings in the app's scope, worded, grouped and ordered as the app's own Settings
// shows them, each saved as it changes. The app's catalogue and settings are read once when the
// dialog first opens and kept for the page's lifetime. Escape, the close button or a click outside
// closes it; Tab stays inside while it is open, and the page gives focus back to the card.
export default function AppSettingsDialog({
  app,
  settingsHref,
  onClose,
}: {
  app: ListedApp & { id: AppId };
  settingsHref: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [value, setValue] = useState<AppScopes | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void Promise.all([loadCatalogue(app.id), loadAppScopes(app.id)]).then(
      ([catalogue, scopes]) => {
        if (!live) return;
        if (!scopes.ok) return setLoad({ state: 'error', error: scopes.error });
        setValue(scopes.data);
        setLoad({ state: 'ready', catalogue });
      },
      () => live && setLoad({ state: 'error', error: 'offline' }),
    );
    return () => {
      live = false;
    };
  }, [app.id, attempt]);

  // Focus moves into the dialog as it opens, and the page behind it holds still.
  useEffect(() => {
    panel.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px] motion-reduce:animate-none dark:bg-black/60"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative flex max-h-[92dvh] w-full animate-fade-in flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 focus:outline-none motion-reduce:animate-none sm:max-h-[min(85dvh,46rem)] sm:max-w-xl sm:rounded-3xl dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/60"
      >
        <span
          aria-hidden
          className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden dark:bg-slate-700"
        />
        <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 pt-4 pb-4 sm:px-6 sm:pt-5 dark:border-slate-800">
          <AppMark app={app} className="size-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-base leading-6 font-semibold text-slate-900 dark:text-white"
            >
              {app.name} Settings
            </h2>
            <p id={descriptionId} className="text-sm text-slate-600 dark:text-slate-400">
              Saved to your account as you change them. {app.name} uses them the next time it opens.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="relative touch-target -mt-1 -mr-2 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:ring-white/30"
          >
            <CloseIcon aria-hidden className="size-[18px]" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          {load.state === 'loading' && <Skeleton />}
          {load.state === 'error' && (
            <div>
              <ErrorNote>{settingsErrorMessage(load.error)}</ErrorNote>
              <button
                type="button"
                onClick={() => {
                  setLoad({ state: 'loading' });
                  setAttempt((n) => n + 1);
                }}
                className="mt-3 cursor-pointer text-sm font-semibold text-slate-900 underline underline-offset-2 dark:text-white"
              >
                Try again
              </button>
            </div>
          )}
          {load.state === 'ready' && value && (
            <AppSettingsBody
              app={app.id}
              catalogue={load.catalogue}
              value={value}
              onValue={setValue}
            />
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5 sm:px-6 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="min-w-0 flex-1 basis-56 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-900 dark:text-white">
              More in {app.name} Settings.
            </span>{' '}
            Appearance, shortcuts and what only makes sense in the editor, in Settings there.
          </p>
          <a
            href={settingsHref}
            className="relative touch-target-y inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors duration-micro hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Open {app.name}
            <OutIcon aria-hidden className="size-3.5" />
          </a>
        </footer>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-busy className="space-y-3 py-1">
      <div className="h-4 w-24 animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70" />
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70"
        />
      ))}
    </div>
  );
}

// The app's categories and their rows. Each change shows at once and is written alone, as a patch
// of just the keys it touches in the app's scope; a write that fails puts that key back, unless a
// newer change to it has gone since.
export function AppSettingsBody({
  app,
  catalogue,
  value,
  onValue,
}: {
  app: AppId;
  catalogue: AppCatalogue;
  value: AppScopes;
  onValue: (next: AppScopes) => void;
}) {
  const current = useRef(value);
  const latest = useRef<Record<string, number>>({});
  const inFlight = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, flashSaved] = useSavedFlash();

  const show = useCallback(
    (next: AppScopes) => {
      current.current = next;
      rememberAppScopes(app, next);
      onValue(next);
    },
    [app, onValue],
  );

  const change = useCallback(
    async (binding: CatalogueBinding, stored: StoredValue) => {
      const before = current.current;
      const { key } = binding;
      const had = Object.hasOwn(before.app, key);
      const previous = before.app[key];
      const patch = storedPatch(before.app, binding, stored);
      // Counted as the app's own Settings counts it, before the write as there.
      reportAppSetting(app, binding, stored);
      const turn = (latest.current[key] ?? 0) + 1;
      latest.current[key] = turn;
      setError(null);
      show({ ...before, app: { ...before.app, ...patch } });
      inFlight.current += 1;
      const result = await patchAppScope(app, patch);
      inFlight.current -= 1;
      if (latest.current[key] !== turn) return;
      if (result.ok) {
        // The server's copy, once nothing else is on its way.
        if (inFlight.current === 0) show({ all: result.data.all, app: result.data.app });
        flashSaved();
        return;
      }
      const reverted = { ...current.current.app };
      if (had) reverted[key] = previous;
      else delete reverted[key];
      show({ ...current.current, app: reverted });
      setError(result.error);
    },
    [app, show, flashSaved],
  );

  const joined = joinSettings(value.all, value.app);
  const categories = catalogue.categories
    .map((category) => ({ category, rows: visibleRows(category, value) }))
    .filter(({ rows }) => rows.length > 0);

  return (
    <>
      <div className="space-y-6">
        {categories.map(({ category, rows }) => (
          <CategoryBlock key={category.id} title={category.label}>
            {sectionRuns(rows).map((run, index) => (
              <div key={`${run.section ?? ''}-${index}`} className={index > 0 ? 'mt-3' : ''}>
                {run.section && (
                  <h4 className="mt-1 mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    {run.section}
                  </h4>
                )}
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {run.rows.map((row) => (
                    <RowItem
                      key={row.id}
                      row={row}
                      joined={joined}
                      onChange={(binding, stored) => void change(binding, stored)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </CategoryBlock>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Everything else is set in the app itself.
          </p>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {saved ? 'Saved' : ''}
      </p>
      {error && <ErrorNote>{settingsErrorMessage(error)}</ErrorNote>}
    </>
  );
}

function CategoryBlock({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-white"
      >
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

type OnChange = (binding: CatalogueBinding, stored: StoredValue) => void;

function RowItem({
  row,
  joined,
  onChange,
}: {
  row: CatalogueRow;
  joined: Record<string, unknown>;
  onChange: OnChange;
}) {
  const labelId = useId();
  const descriptionId = useId();
  const nested = row.when !== undefined;
  const text = (
    <div className="min-w-0 flex-1 basis-56">
      <p id={labelId} className="text-sm font-medium text-slate-900 dark:text-white">
        {row.label}
      </p>
      <p id={descriptionId} className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {row.description}
      </p>
    </div>
  );
  return (
    <li
      className={`py-3 first:pt-1.5 last:pb-1.5 ${
        nested ? 'ml-1 border-l-2 border-slate-100 pl-4 dark:border-slate-800' : ''
      }`}
    >
      {row.kind === 'toggleGroup' ? (
        <>
          {text}
          <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {row.toggles.map((toggle) => (
              <ToggleTile key={toggle.id} toggle={toggle} joined={joined} onChange={onChange} />
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          {text}
          {row.kind === 'toggle' && (
            <Switch
              checked={readToggleValue(joined, row)}
              labelledBy={labelId}
              describedBy={descriptionId}
              onChange={(next) => onChange(row, next ? row.on : row.off)}
            />
          )}
          {row.kind === 'choice' && (
            <Segmented
              row={row}
              selected={readChoiceValue(joined, row)}
              labelledBy={labelId}
              describedBy={descriptionId}
              onChange={onChange}
            />
          )}
          {row.kind === 'slider' && (
            <Slider
              row={row}
              stored={readSliderValue(joined, row)}
              labelledBy={labelId}
              describedBy={descriptionId}
              onChange={onChange}
            />
          )}
        </div>
      )}
    </li>
  );
}

function ToggleTile({
  toggle,
  joined,
  onChange,
}: {
  toggle: ToggleBinding & { id: string; label: string };
  joined: Record<string, unknown>;
  onChange: OnChange;
}) {
  const labelId = useId();
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
      <span id={labelId} className="text-sm text-slate-800 dark:text-slate-200">
        {toggle.label}
      </span>
      <Switch
        checked={readToggleValue(joined, toggle)}
        labelledBy={labelId}
        onChange={(next) => onChange(toggle, next ? toggle.on : toggle.off)}
      />
    </li>
  );
}

// A choice as the apps draw it: a row of segments, one per option. Arrow keys move the choice, as in
// any radio group, and only the chosen segment is a Tab stop.
function Segmented({
  row,
  selected,
  labelledBy,
  describedBy,
  onChange,
}: {
  row: CatalogueChoice;
  selected: string;
  labelledBy: string;
  describedBy: string;
  onChange: OnChange;
}) {
  const group = useRef<HTMLSpanElement>(null);
  const pick = (index: number) => {
    const option = row.options[(index + row.options.length) % row.options.length]!;
    if (option.id !== selected) onChange(row, option.value);
    group.current
      ?.querySelectorAll<HTMLElement>('[role="radio"]')
      [row.options.indexOf(option)]?.focus();
  };
  const at = Math.max(
    0,
    row.options.findIndex((option) => option.id === selected),
  );
  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step !== undefined) {
      event.preventDefault();
      pick(at + step);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      pick(event.key === 'Home' ? 0 : row.options.length - 1);
    }
  }
  return (
    <span
      ref={group}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
      className="inline-flex max-w-full shrink-0 gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800"
    >
      {row.options.map((option, index) => {
        const active = index === at;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => !active && onChange(row, option.value)}
            className={`relative touch-target-y cursor-pointer rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:outline-none motion-reduce:transition-none dark:focus-visible:ring-white/30 ${
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </span>
  );
}

// A slider with the app's own label for its value. It moves at once and saves once it rests.
function Slider({
  row,
  stored,
  labelledBy,
  describedBy,
  onChange,
}: {
  row: CatalogueSlider;
  stored: number;
  labelledBy: string;
  describedBy: string;
  onChange: OnChange;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const shown = draft ?? stored;
  const index = Math.round((shown - row.min) / row.step);
  const label = row.labels[index] ?? String(shown);
  function move(next: number) {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDraft(null);
      onChange(row, next);
    }, SLIDER_SAVE_DELAY_MS);
  }
  return (
    <span className="flex w-full shrink-0 items-center gap-3 sm:w-56">
      <input
        type="range"
        min={row.min}
        max={row.max}
        step={row.step}
        value={shown}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-valuetext={label}
        onChange={(event) => move(Number(event.target.value))}
        className="h-6 min-w-0 flex-1 cursor-pointer accent-slate-900 dark:accent-white"
      />
      <output className="w-12 text-right text-sm text-slate-700 tabular-nums dark:text-slate-300">
        {label}
      </output>
    </span>
  );
}
