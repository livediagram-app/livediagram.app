'use client';

import {
  lazy,
  Suspense,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { lucideGlyph } from '@livediagram/ui';
import {
  lucideChevronRight,
  lucideMail,
  lucideShieldCheck,
  lucideSlidersHorizontal,
  lucideUser,
} from '@livediagram/icons/lucide';
import { accountApi } from '@/lib/account-api';
import {
  appSettingsLinks,
  readToggle,
  TOGGLE_SECTIONS,
  type SettingsBlob,
  type ToggleRow,
  type ToggleSection,
} from '@/lib/account-settings';
import { appFromParam, loadCatalogue, type AppId } from '@/lib/app-settings';
import { listedApps, type ListedApp } from '@/lib/apps';
import { AppMark } from '../landing/AppLogo';
import { ErrorNote } from './AccountShell';
import { ProfileCard, type Profile } from './ProfileCard';
import { settingsErrorMessage, useSavedFlash } from './settings-ui';
import { useAccountData } from './useAccountData';

const UserIcon = lucideGlyph(lucideUser, 16);
const MailIcon = lucideGlyph(lucideMail, 16);
const ShieldIcon = lucideGlyph(lucideShieldCheck, 16);
const AppsIcon = lucideGlyph(lucideSlidersHorizontal, 16);
const OpenIcon = lucideGlyph(lucideChevronRight, 16);

const noChange = () => () => {};

// The app settings dialog, loaded only when one first opens (or the pointer heads for a card).
const loadDialog = () => import('./AppSettingsDialog');
const AppSettingsDialog = lazy(loadDialog);

const SECTION_ICONS: Record<string, typeof MailIcon> = {
  notifications: MailIcon,
  privacy: ShieldIcon,
};

// The settings page (liveworkspace/docs/site.md "Your account"): the profile collaborators see, and the
// settings every app shares (the `all` scope), each saved as it changes. One read each for the
// settings and the profile when the page opens; each switch is one write, shown at once and put back
// if the write fails.
export function SettingsPanel() {
  const [settings] = useAccountData<{ all: SettingsBlob }>('/settings');
  const [profile] = useAccountData<{ profile: Profile | null }>('/profile');

  return (
    <div className="space-y-6">
      <SettingsCard
        id="profile"
        title="Profile"
        icon={<UserIcon aria-hidden className="size-4" />}
        hint="How collaborators see you in every app: on your cursor, your comments and who’s here."
      >
        {profile.state === 'loading' && <Skeleton rows={2} />}
        {profile.state === 'error' && <ErrorNote>{settingsErrorMessage(profile.error)}</ErrorNote>}
        {profile.state === 'ready' && <ProfileCard initial={profile.data.profile} />}
      </SettingsCard>

      {TOGGLE_SECTIONS.map((section) => (
        <SettingsCard
          key={section.id}
          id={section.id}
          title={section.title}
          icon={(() => {
            const Icon = SECTION_ICONS[section.id] ?? MailIcon;
            return <Icon aria-hidden className="size-4" />;
          })()}
          hint={section.hint}
        >
          {settings.state === 'loading' && <Skeleton rows={section.rows.length > 3 ? 4 : 2} />}
          {settings.state === 'error' && (
            <ErrorNote>{settingsErrorMessage(settings.error)}</ErrorNote>
          )}
          {settings.state === 'ready' && (
            <ToggleList section={section} initial={settings.data.all} />
          )}
        </SettingsCard>
      ))}

      <SettingsCard
        id="apps"
        title="Your apps"
        icon={<AppsIcon aria-hidden className="size-4" />}
        hint="Each app’s own settings: how its editor looks and handles, and what only it has."
      >
        <AppCards />
      </SettingsCard>
    </div>
  );
}

export function SettingsCard({
  id,
  title,
  icon,
  hint,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-24 lg:scroll-mt-36 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {icon}
        </span>
        <div className="min-w-0">
          <h2
            id={headingId}
            className="text-base leading-8 font-semibold text-slate-900 dark:text-white"
          >
            {title}
          </h2>
          {hint && <p className="text-sm text-slate-600 dark:text-slate-400">{hint}</p>}
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div aria-busy className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70"
        />
      ))}
    </div>
  );
}

// A card's switches. Each change shows at once and is written alone (`PATCH { all: { key } }`); a
// write that fails puts that switch back, unless a newer change to it has gone since.
function ToggleList({ section, initial }: { section: ToggleSection; initial: SettingsBlob }) {
  const [values, setValues] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(section.rows.map((row) => [row.key, readToggle(initial, row)])),
  );
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Record<string, number>>({});
  const [saved, flashSaved] = useSavedFlash();

  async function change(row: ToggleRow, next: boolean) {
    const previous = values[row.key] ?? row.fallback;
    const turn = (latest.current[row.key] ?? 0) + 1;
    latest.current[row.key] = turn;
    setError(null);
    setValues((v) => ({ ...v, [row.key]: next }));
    const result = await accountApi('/settings', 'PATCH', { all: { [row.key]: next } });
    if (latest.current[row.key] !== turn) return;
    if (result.ok) flashSaved();
    else {
      setValues((v) => ({ ...v, [row.key]: previous }));
      setError(result.error);
    }
  }

  return (
    <>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {section.rows.map((row) => (
          <ToggleRowItem
            key={row.key}
            row={row}
            checked={values[row.key] ?? row.fallback}
            onChange={(next) => void change(row, next)}
          />
        ))}
      </ul>
      <p aria-live="polite" className="sr-only">
        {saved ? 'Saved' : ''}
      </p>
      {error && <ErrorNote>{settingsErrorMessage(error)}</ErrorNote>}
    </>
  );
}

function ToggleRowItem({
  row,
  checked,
  onChange,
}: {
  row: ToggleRow;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <li className="flex items-center gap-4 py-3.5 first:pt-1 last:pb-1">
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-sm font-medium text-slate-900 dark:text-white">
          {row.label}
        </p>
        <p id={descriptionId} className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {row.description}
        </p>
      </div>
      <Switch
        checked={checked}
        labelledBy={labelId}
        describedBy={descriptionId}
        onChange={onChange}
      />
    </li>
  );
}

export function Switch({
  checked,
  labelledBy,
  describedBy,
  onChange,
}: {
  checked: boolean;
  labelledBy: string;
  describedBy?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className={`relative touch-target inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none dark:focus-visible:ring-white/30 dark:focus-visible:ring-offset-slate-900 ${
        checked ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'
      }`}
    >
      <span
        aria-hidden
        className={`size-5 rounded-full shadow-sm transition-transform duration-micro motion-reduce:transition-none ${
          checked ? 'translate-x-5 bg-white dark:bg-slate-900' : 'translate-x-0 bg-white'
        }`}
      />
    </button>
  );
}

// A card per app, in its colours, each opening that app's own settings in a dialog here
// (AppSettingsDialog). `?app=<name>` opens one as the page loads, and the address follows the dialog,
// so it can be linked to. Closing it gives focus back to its card.
function AppCards() {
  const apps = listedApps();
  const links = appSettingsLinks();
  // The app the address names until a card is opened or the dialog closed (undefined till then).
  const deepLinked = useSyncExternalStore(
    noChange,
    () => appFromParam(new URLSearchParams(window.location.search).get('app')),
    () => null,
  );
  const [chosen, setChosen] = useState<AppId | null | undefined>(undefined);
  const open = chosen === undefined ? deepLinked : chosen;
  const cards = useRef(new Map<AppId, HTMLButtonElement>());

  function follow(app: AppId | null) {
    const url = new URL(window.location.href);
    const name = app && apps.find((a) => a.id === app)?.name;
    if (name) url.searchParams.set('app', name);
    else url.searchParams.delete('app');
    window.history.replaceState(window.history.state, '', url);
  }

  function show(app: AppId) {
    setChosen(app);
    follow(app);
  }

  function close() {
    const app = open;
    setChosen(null);
    follow(null);
    if (app) cards.current.get(app)?.focus();
  }

  // Fetching the dialog's code and the app's catalogue as the pointer arrives, so it opens at once.
  function prefetch(app: AppId) {
    void loadDialog();
    void loadCatalogue(app);
  }

  const openApp = open ? apps.find((a) => a.id === open) : undefined;
  const openLink = open ? links.find((l) => l.id === open) : undefined;

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {links.map((link) => {
          const app = apps.find((a) => a.id === link.id);
          const id = link.id as AppId;
          return (
            <li key={link.id}>
              <button
                ref={(node) => {
                  if (node) cards.current.set(id, node);
                  else cards.current.delete(id);
                }}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open === id}
                onClick={() => show(id)}
                onPointerEnter={() => prefetch(id)}
                onFocus={() => prefetch(id)}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition-colors duration-micro hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-900/20 focus-visible:outline-none dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60 dark:focus-visible:ring-white/30"
              >
                {app && <AppMark app={app} className="size-8 shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                    {link.name} Settings
                  </span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {link.pitch}
                  </span>
                </span>
                <OpenIcon
                  aria-hidden
                  className="size-4 shrink-0 text-slate-400 transition-transform duration-micro group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </button>
            </li>
          );
        })}
      </ul>
      {openApp && openLink && (
        <Suspense fallback={null}>
          <AppSettingsDialog
            app={openApp as ListedApp & { id: AppId }}
            settingsHref={openLink.href}
            onClose={close}
          />
        </Suspense>
      )}
    </>
  );
}
