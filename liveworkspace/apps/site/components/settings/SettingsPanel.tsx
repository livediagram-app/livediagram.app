'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { lucideGlyph } from '@livediagram/ui';
import {
  lucideArrowUpRight,
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
import { listedApps } from '@/lib/apps';
import { AppMark } from '../landing/AppLogo';
import { ErrorNote } from './AccountShell';
import { ProfileCard, type Profile } from './ProfileCard';
import { settingsErrorMessage, useSavedFlash } from './settings-ui';
import { useAccountData } from './useAccountData';

const UserIcon = lucideGlyph(lucideUser, 16);
const MailIcon = lucideGlyph(lucideMail, 16);
const ShieldIcon = lucideGlyph(lucideShieldCheck, 16);
const AppsIcon = lucideGlyph(lucideSlidersHorizontal, 16);
const OutIcon = lucideGlyph(lucideArrowUpRight, 16);

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
        hint="Everything else is set in each app, in its own Settings: how its editor looks and handles, and what only it has."
      >
        <AppLinks />
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
      className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900"
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

// Each app's own Settings, a tile per app in its colours.
function AppLinks() {
  const apps = listedApps();
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {appSettingsLinks().map((link) => {
        const app = apps.find((a) => a.id === link.id);
        return (
          <li key={link.id}>
            <a
              href={link.href}
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition-colors duration-micro hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
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
              <OutIcon
                aria-hidden
                className="size-4 shrink-0 text-slate-400 transition-transform duration-micro group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
              />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
