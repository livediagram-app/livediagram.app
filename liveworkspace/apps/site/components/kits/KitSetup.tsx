'use client';

// The setup under the kits (liveworkspace/docs/specs/010-site/site.md "Start a Project"), in place: the project's
// name, the role its connections give (the shared role switch, Editor first) with its line, and Create. Signed out,
// Create is Sign In to Create; until the session is known it waits.
import { useId } from 'react';
import { KIT_NAME_MAX, type Kit, type Level } from '@liveworkspace/index-client';
import { ACCOUNT_BUTTON as BUTTON } from '@liveworkspace/settings-ui';
import { PANEL_INK, RoleSwitch } from '@liveworkspace/ui';
import { createLabels, fallbackLines, LEVEL_TITLES, LEVELS, roleLine } from './kit-words';

const ROLE_OPTIONS = LEVELS.map((value) => ({ value, label: LEVEL_TITLES[value] }));

export function KitSetup({
  kit,
  name,
  onName,
  level,
  onLevel,
  signedIn,
  signInHref,
  error,
  onCreate,
}: {
  kit: Kit;
  name: string;
  onName: (name: string) => void;
  level: Level;
  onLevel: (level: Level) => void;
  signedIn: 'checking' | 'out' | 'in';
  signInHref: string;
  error: string | null;
  onCreate: () => void;
}) {
  const nameId = useId();
  const roleId = useId();
  const lineId = useId();
  const errorId = useId();
  const labels = createLabels(kit);
  const fallbacks = fallbackLines(kit, level);
  return (
    <form
      className={`mt-8 grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start dark:border-slate-800 dark:bg-slate-900 ${PANEL_INK}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (signedIn === 'in') onCreate();
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className="text-sm font-medium text-slate-900 dark:text-white">
          Project Name
        </label>
        <input
          id={nameId}
          value={name}
          maxLength={KIT_NAME_MAX}
          placeholder={kit.title}
          autoComplete="off"
          onChange={(e) => onName(e.target.value)}
          className="min-h-11 rounded-[10px] border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-brand-400 dark:focus:ring-brand-400/30"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span id={roleId} className="text-sm font-medium text-slate-900 dark:text-white">
          Role
        </span>
        <RoleSwitch
          value={level}
          options={ROLE_OPTIONS}
          onChange={onLevel}
          label="Role the connections give"
          describedBy={lineId}
          size="large"
        />
        <div id={lineId} className="text-xs text-slate-600 dark:text-slate-400">
          <p>{roleLine(level)}</p>
          {fallbacks.map((line) => (
            <p key={line} className="mt-1">
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 md:pt-7">
        {signedIn === 'out' ? (
          <a
            href={signInHref}
            className={`${BUTTON.primary} relative touch-target-y min-h-11 px-6 py-2.5 text-center`}
          >
            Sign In to Create
          </a>
        ) : (
          <button
            type="submit"
            disabled={signedIn === 'checking'}
            aria-describedby={error ? errorId : undefined}
            className={`${BUTTON.primary} relative touch-target-y min-h-11 px-6 py-2.5`}
          >
            <span className="hidden sm:inline">{labels.wide}</span>
            <span className="sm:hidden">{labels.narrow}</span>
          </button>
        )}
        {error ? (
          <p id={errorId} role="alert" className="max-w-56 text-xs text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
