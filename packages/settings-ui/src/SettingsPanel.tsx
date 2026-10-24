'use client';

import { lazy, Suspense, type ReactNode } from 'react';
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

export type SettingsPanelApp = { id: SettingsAppId; name: string };

// The one Settings panel (each app's docs/specs/007-editor/user-preferences.md "This app or All";
// liveworkspace/docs/site.md "Settings"): every app's Settings and liveworkspace.app's render it, inside their own
// dialog frame. Its header switch, as the Explorer's, picks between this app's settings alone and All: the
// account's own (its profile, emails, privacy and accessibility, API tokens), then every app's settings under the
// app's name and logo. The host passes only what differs: which app it is, its own settings model where it has one
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
  const common = {
    ...view,
    switcher,
    focus,
    initialCategoryId,
    initialSectionId,
  };

  // An editor's own settings: drawn at once, with nothing fetched.
  if (shown === 'app' && own) {
    return <SettingsView key="app" {...common} categories={own} memoryKey={memoryKey} />;
  }

  const catalogueProps: CatalogueSettingsViewProps = {
    ...common,
    mode: shown,
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
        <SettingsView
          {...common}
          categories={[]}
          placeholder={<div aria-busy className="h-40" />}
        />
      }
    >
      <CatalogueSettingsView key={shown} {...catalogueProps} />
    </Suspense>
  );
}
