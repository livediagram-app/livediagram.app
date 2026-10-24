'use client';

import { lazy, Suspense, useRef, useState, useSyncExternalStore } from 'react';
import { groupedId, preloadSettingsPanel, type SettingsScope } from '@liveworkspace/settings-ui';
import { appFromParam, loadCatalogue, type AppId } from '@/lib/app-settings';
import { BUTTON } from './AccountShell';

// The Settings panel's code, fetched as the page opens it (or the pointer heads for the button).
const loadDialog = () => import('./SiteSettingsDialog');
const SiteSettingsDialog = lazy(loadDialog);

const noChange = () => () => {};

// The Account section's categories a link can name (`#notifications`, every email's unsubscribe link).
const ACCOUNT_ANCHORS: Record<string, string> = {
  profile: 'account',
  notifications: 'notifications',
  privacy: 'privacy',
  accessibility: 'accessibility',
  tokens: 'tokens',
};

export type SettingsTarget = {
  app: AppId | null;
  scope: SettingsScope | null;
  categoryId: string | null;
};

/** What the address asks the panel to open on: `?app=<name>` that app's settings (`?app=all` All), and an Account
 *  category's `#anchor` that category in All. */
export function settingsTarget(search: string, hash: string): SettingsTarget {
  const param = new URLSearchParams(search).get('app');
  const app = appFromParam(param);
  const anchor = ACCOUNT_ANCHORS[hash.replace(/^#/, '')];
  if (anchor) return { app, scope: 'all', categoryId: groupedId('account', anchor) };
  if (param === 'all' || hash === '#apps') return { app, scope: 'all', categoryId: null };
  return { app, scope: app ? 'app' : null, categoryId: null };
}

const readTarget = () => settingsTarget(window.location.search, window.location.hash);
let lastTarget: { key: string; target: SettingsTarget } | null = null;
// The same object while the address is the same, as useSyncExternalStore needs.
function currentTarget(): SettingsTarget {
  const key = window.location.search + window.location.hash;
  if (lastTarget?.key !== key) lastTarget = { key, target: readTarget() };
  return lastTarget.target;
}
const NO_TARGET: SettingsTarget = { app: null, scope: null, categoryId: null };

// /account/settings (liveworkspace/docs/site.md "Settings"): the Settings panel, opened over the account page as it
// loads, on what the address names. Closing it leaves a way to open it again here, for the same app; the address
// drops the category it named, so opening again doesn't jump back to it.
export function SettingsLanding() {
  const target = useSyncExternalStore(noChange, currentTarget, () => NO_TARGET);
  const [open, setOpen] = useState(true);
  const button = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    if (window.location.hash) {
      const url = new URL(window.location.href);
      url.hash = '';
      window.history.replaceState(window.history.state, '', url);
    }
    button.current?.focus();
  }

  function prefetch() {
    void loadDialog();
    preloadSettingsPanel();
    if (target.app) void loadCatalogue(target.app);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-base font-semibold text-slate-900 dark:text-white">
        Every setting, in one place
      </p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
        Your profile, the emails we send you, privacy and accessibility, and each app’s own
        settings. Pick an app at the top to see only its settings, or All for everything.
      </p>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        className={`${BUTTON.primary} mt-5`}
      >
        Open Settings
      </button>
      {open && target !== NO_TARGET ? (
        <Suspense fallback={null}>
          <SiteSettingsDialog
            key={`${target.app}:${target.scope}:${target.categoryId}`}
            app={target.app}
            initialScope={target.scope}
            initialCategoryId={target.categoryId}
            onClose={close}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
