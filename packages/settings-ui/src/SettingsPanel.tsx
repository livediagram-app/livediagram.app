'use client';

import { lazy, Suspense, type CSSProperties, type ReactNode } from 'react';
import type { CatalogueBinding, StoredValue } from '@liveworkspace/settings/catalogue';
import type { AccountHost, CatalogueSettingsViewProps } from './CatalogueSettingsView';
import type { SettingsCategory } from './model';
import { SettingsScopeSwitch, type SettingsScope } from './scope';
import type { SettingsAppId, SettingsRequest, SettingsStore } from './store';
import { SettingsView, type SettingsFocus } from './SettingsView';

// The All view and the catalogue-driven app view: their own chunk, fetched the first time either is shown (or the
// host prefetches it as Settings is pointed at), never for an editor showing its own settings.
const loadCatalogueView = () => import('./CatalogueSettingsView');
const CatalogueSettingsView = lazy(loadCatalogueView);

/** Fetches the All view's code ahead of time (a pointer heading for Settings, say). */
export function preloadSettingsPanel(): void {
  void loadCatalogueView();
}

// `live`: "live" in the app's wordmark in the header, on light and on dark (site.md "Settings" "The app's name").
export type SettingsPanelApp = {
  id: SettingsAppId;
  name: string;
  live?: { light: string; dark: string };
};

/** The panel's app from its entry in `@liveworkspace/sites`: its id, name and wordmark colours ("live" in its deep
 *  shade on light, its accent on dark). */
export function settingsPanelApp(site: {
  id: SettingsAppId;
  name: string;
  deep: string;
  accent: string;
}): SettingsPanelApp {
  return { id: site.id, name: site.name, live: { light: site.deep, dark: site.accent } };
}

// The one Settings panel (each app's docs/specs/007-editor/user-preferences.md "This app or All";
// liveworkspace/docs/site.md "Settings"): every app's Settings and liveworkspace.app's render it, inside their own
// dialog frame. Its header switch, as the Explorer's, picks between this app's settings alone and All: the
// account's own (its profile, emails, privacy and accessibility, API tokens), then one set of categories merged
// across every app, each app's own rows under its name and logo (merge-categories.ts). The host passes only what differs: which app it is, its own settings model where it has one
// (an editor), how to reach the accounts API, and the logos.
export function SettingsPanel({
  app,
  own,
  allowAll = true,
  scope,
  onScopeChange,
  store,
  account,
  renderLogo,
  reportApp,
  reportShared,
  errorMessage,
  memoryKey = null,
  focus = null,
  initialCategoryId = null,
  initialSectionId = null,
  ...view
}: {
  // "This app": the app the panel was opened for. Null (liveworkspace.app opened from no app) shows All alone.
  app: SettingsPanelApp | null;
  // This app's own settings model, where the host has it (an editor). Without it, the app's settings come from its
  // plain-data catalogue over the accounts API.
  own?: readonly SettingsCategory[];
  // Whether All is offered (signed in, with the account's settings to show).
  allowAll?: boolean;
  scope: SettingsScope;
  onScopeChange: (next: SettingsScope) => void;
  // How to reach the accounts API: the host's store (one it also reads from), or just its request, whose store is
  // made when All is first shown.
  store: SettingsStore | SettingsRequest;
  account: AccountHost;
  renderLogo: (id: SettingsAppId | 'all') => ReactNode;
  reportApp?: (app: SettingsAppId, binding: CatalogueBinding, stored: StoredValue) => void;
  reportShared?: (key: string, value: StoredValue) => Promise<void> | void;
  // What to say when the accounts API refuses (the shared wording by default).
  errorMessage?: (error: string) => string;
  // The view's memory for the app's own view; All's is kept beside it (`<key>:all`).
  memoryKey?: string | null;
  // Where to land, in the scope shown first.
  focus?: SettingsFocus | null;
  initialCategoryId?: string | null;
  initialSectionId?: string | null;
  isMobile: boolean;
  onClose: () => void;
  title?: string;
  leading?: ReactNode;
  footer?: ReactNode;
  onCategoryOpened?: (categoryId: string) => void;
}) {
  const shown: SettingsScope = app && (scope === 'app' || !allowAll) ? 'app' : 'all';
  const switcher =
    app && allowAll ? (
      <SettingsScopeSwitch
        value={shown}
        onChange={onScopeChange}
        appName={app.name}
        appLogo={renderLogo(app.id)}
        allLogo={renderLogo('all')}
      />
    ) : undefined;
  // Opened for an app, the title reads as the app's: its logo and wordmark, then "Settings".
  const leading =
    view.leading ??
    (app ? <AppWordmark name={app.name} logo={renderLogo(app.id)} live={app.live} /> : undefined);
  const common = {
    ...view,
    leading,
    switcher,
    focus,
    initialCategoryId,
    initialSectionId,
  };

  // Signed in, the app's own view also holds the Account section and Common: they shape this app too.
  const withShared = shown === 'app' && allowAll && !account.guest;
  // A guest's editor: its own settings, drawn at once, with nothing fetched.
  if (shown === 'app' && own && !withShared) {
    return <SettingsView key="app" {...common} categories={own} memoryKey={memoryKey} />;
  }

  const catalogueProps: CatalogueSettingsViewProps = {
    ...common,
    mode: shown,
    withShared,
    current: app?.id ?? null,
    ...(own ? { own } : {}),
    store,
    account,
    renderLogo,
    ...(reportApp ? { reportApp } : {}),
    ...(reportShared ? { reportShared } : {}),
    ...(errorMessage ? { errorMessage } : {}),
    memoryKey: memoryKey && shown === 'all' ? `${memoryKey}:all` : memoryKey,
  };
  return (
    <Suspense
      fallback={
        withShared && own ? (
          // An editor's own settings at once, while the rest of its side loads.
          <SettingsView {...common} categories={own} memoryKey={memoryKey} />
        ) : (
          <SettingsView
            {...common}
            categories={[]}
            placeholder={<div aria-busy className="h-40" />}
          />
        )
      }
    >
      <CatalogueSettingsView key={shown} {...catalogueProps} />
    </Suspense>
  );
}

// The app's logo and name, "live" in its accent as its own wordmark has it. A logotype: WCAG 1.4.3 sets text that is
// part of a logo no contrast minimum, and the contrast audits skip it by this mark.
function AppWordmark({
  name,
  logo,
  live: colours,
}: {
  name: string;
  logo: ReactNode;
  live?: { light: string; dark: string } | undefined;
}) {
  const live = name.startsWith('live') ? 'live' : '';
  return (
    <span
      data-settings-app-title=""
      className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 [&_svg]:size-5"
    >
      {logo}
      <span data-logotype="">
        {live ? (
          <span
            className={
              colours ? 'text-[var(--live-light)] dark:text-[var(--live-dark)]' : undefined
            }
            style={
              colours
                ? ({ '--live-light': colours.light, '--live-dark': colours.dark } as CSSProperties)
                : undefined
            }
          >
            {live}
          </span>
        ) : null}
        {name.slice(live.length)}
      </span>
    </span>
  );
}
