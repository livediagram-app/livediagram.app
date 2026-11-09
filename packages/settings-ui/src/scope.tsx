'use client';

import { possessive } from '@liveworkspace/sites';
import { useState, type ReactNode } from 'react';

// The Settings panel's header switch, as the Explorer's (each app's name with its logo, beside All with
// liveworkspace's): this app's settings alone, or every setting the account has (each app's
// docs/specs/007-editor/user-preferences.md "This app or All"; liveworkspace/docs/specs/010-site/site.md "Settings").
export type SettingsScope = 'app' | 'all';

/** The switch's state: a targeted open's choice when given, else this app's. Nothing is remembered between opens:
 *  Settings opened from an app always starts on that app (All is one press away). */
export function useSettingsScope(
  initial: SettingsScope | null = null,
): [SettingsScope, (next: SettingsScope) => void] {
  const [scope, setScope] = useState<SettingsScope>(() => initial ?? 'app');
  return [scope, setScope];
}

const SEGMENTS =
  'flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800';
const segment = (active: boolean) =>
  `flex h-7 min-w-0 items-center justify-center rounded px-2 text-xs font-medium transition ${
    active
      ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200'
      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
  }`;

function Logo({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <span aria-hidden className="mr-1.5 inline-flex shrink-0 [&_svg]:size-4">
      {children}
    </span>
  );
}

/** The two segments: this app (its logo and name) and All (liveworkspace's logo). */
export function SettingsScopeSwitch({
  value,
  onChange,
  appName,
  appLogo,
  allLogo,
  allLabel = 'All',
  className = '',
}: {
  value: SettingsScope;
  onChange: (next: SettingsScope) => void;
  appName: string;
  appLogo?: ReactNode;
  allLogo?: ReactNode;
  allLabel?: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Show settings for" className={`${SEGMENTS} ${className}`}>
      <button
        type="button"
        aria-pressed={value === 'app'}
        onClick={() => onChange('app')}
        title={`Only ${possessive(appName)} settings`}
        className={segment(value === 'app')}
      >
        <Logo>{appLogo}</Logo>
        <span className="truncate">{appName}</span>
      </button>
      <button
        type="button"
        aria-pressed={value === 'all'}
        onClick={() => onChange('all')}
        title="Every setting: your account’s and every app’s"
        className={segment(value === 'all')}
      >
        <Logo>{allLogo}</Logo>
        {allLabel}
      </button>
    </div>
  );
}
