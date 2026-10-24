'use client';

// The Settings panel's view over what it reads from the accounts API (liveworkspace/docs/site.md "Settings"): one
// app's settings from its plain-data catalogue (liveworkspace.app, where no app's own Settings is loaded), or the
// All view: the Account section, then each app's settings under its name and logo. Its own chunk, loaded only when
// one of those is first shown, with each app's catalogue fetched beside it; an editor showing its own settings
// never loads it.
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { ACCOUNT_KEYS } from '@liveworkspace/settings/account';
import type {
  AppCatalogue,
  CatalogueBinding,
  StoredValue,
} from '@liveworkspace/settings/catalogue';
import { accountCategories, type AccountSection } from './account-model';
import { catalogueModel } from './catalogue-model';
import { groupCategories } from './groups';
import type { SettingsCategory, SettingsGroupHeading } from './model';
import { createScopesSaver, type PanelScopes, type ScopesSaver } from './saver';
import {
  SETTINGS_APP_IDS,
  loadAppCatalogue,
  settingsApiErrorMessage,
  storeFor,
  type SettingsAppId,
  type SettingsRequest,
  type SettingsStore,
} from './store';
import { SettingsView, type SettingsFocus } from './SettingsView';

// The apps by name, for the All view's headings.
const APP_NAMES: Record<SettingsAppId, string> = {
  'livediagram.app': 'livediagram',
  'liveplanner.app': 'liveplanner',
  'livedocuments.app': 'livedocuments',
  'livedesign.app': 'livedesign',
};

export const ACCOUNT_GROUP = 'account';

export type AccountHost = Omit<AccountSection, 'all' | 'set'> & {
  // Where the host holds the `all` scope itself (an editor's preferences): read and written there rather than over
  // the accounts API.
  shared?: Pick<AccountSection, 'all' | 'set'>;
};

export type CatalogueSettingsViewProps = {
  mode: 'app' | 'all';
  // The app the panel was opened for, if any.
  current: SettingsAppId | null;
  // That app's own Settings, when the host has it (an editor): shown in place of its catalogue.
  own?: readonly SettingsCategory[];
  store: SettingsStore | SettingsRequest;
  account: AccountHost;
  renderLogo: (id: SettingsAppId | 'all') => ReactNode;
  reportApp?: (app: SettingsAppId, binding: CatalogueBinding, stored: StoredValue) => void;
  reportShared?: (key: string, value: StoredValue) => Promise<void> | void;
  errorMessage?: (error: string) => string;
  // The SettingsView's own.
  isMobile: boolean;
  onClose: () => void;
  title?: string;
  leading?: ReactNode;
  footer?: ReactNode;
  switcher?: ReactNode;
  focus?: SettingsFocus | null;
  initialCategoryId?: string | null;
  initialSectionId?: string | null;
  memoryKey?: string | null;
  onCategoryOpened?: (categoryId: string) => void;
};

type Load =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | {
      state: 'ready';
      catalogues: Partial<Record<SettingsAppId, AppCatalogue>>;
      scopes: PanelScopes;
    };

export default function CatalogueSettingsView({
  store: source,
  errorMessage = settingsApiErrorMessage,
  ...rest
}: CatalogueSettingsViewProps) {
  const store = useMemo(() => storeFor(source), [source]);
  const props = { ...rest, store, errorMessage };
  const { mode, current, own } = props;
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // The apps read here: just the one in its own view; in All every app but the one whose own Settings the host
  // already has.
  const apps = useMemo(
    () =>
      mode === 'app'
        ? current
          ? [current]
          : []
        : SETTINGS_APP_IDS.filter((app) => !(own && app === current)),
    [mode, current, own],
  );

  useEffect(() => {
    let live = true;
    void Promise.all(
      apps.map((app) => Promise.all([loadAppCatalogue(app), store.loadApp(app)] as const)),
    ).then(
      (answers) => {
        if (!live) return;
        const failed = answers.find(([, scopes]) => !scopes.ok);
        if (failed && !failed[1].ok) return setLoad({ state: 'error', error: failed[1].error });
        const catalogues: Partial<Record<SettingsAppId, AppCatalogue>> = {};
        const scopes: PanelScopes = { all: {}, apps: {} };
        answers.forEach(([catalogue, read], i) => {
          if (!read.ok) return;
          const app = apps[i]!;
          catalogues[app] = catalogue;
          scopes.apps[app] = read.data.app;
          // Every answer carries the `all` scope; the last one read is the newest.
          scopes.all = read.data.all;
        });
        setLoad({ state: 'ready', catalogues, scopes });
      },
      () => live && setLoad({ state: 'error', error: 'offline' }),
    );
    return () => {
      live = false;
    };
  }, [apps, store, attempt]);

  if (load.state !== 'ready') {
    return (
      <SettingsView
        categories={[]}
        isMobile={props.isMobile}
        onClose={props.onClose}
        title={props.title}
        leading={props.leading}
        switcher={props.switcher}
        footer={props.footer}
        placeholder={
          load.state === 'error' ? (
            <div className="px-4 py-4">
              <ErrorNote>{errorMessage(load.error)}</ErrorNote>
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
          ) : (
            <SettingsSkeleton />
          )
        }
      />
    );
  }
  return <ReadyView {...props} catalogues={load.catalogues} initial={load.scopes} />;
}

function ReadyView({
  mode,
  current,
  own,
  store,
  account,
  renderLogo,
  reportApp,
  reportShared,
  errorMessage,
  catalogues,
  initial,
  footer,
  ...view
}: Omit<CatalogueSettingsViewProps, 'store' | 'errorMessage'> & {
  store: SettingsStore;
  errorMessage: (error: string) => string;
  catalogues: Partial<Record<SettingsAppId, AppCatalogue>>;
  initial: PanelScopes;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);
  const [saver] = useState<ScopesSaver>(() =>
    createScopesSaver({ store, initial, reportApp, reportShared }),
  );
  useLayoutEffect(() => {
    saver.connect({ show: setValue, error: setError, saved: () => setSaved((n) => n + 1) });
  }, [saver]);

  // Rebuilt only when what it reads changes, so a search keystroke keeps every row's identity (and the view's memo).
  const { shared } = account;
  const model = useMemo((): { categories: SettingsCategory[]; groups?: SettingsGroupHeading[] } => {
    const appModel = (app: SettingsAppId) => {
      const catalogue = catalogues[app];
      if (!catalogue) return [];
      return catalogueModel(
        catalogue,
        { all: shared?.all ?? value.all, app: value.apps[app] ?? {} },
        (binding, stored) => saver.changeApp(app, binding, stored),
      );
    };
    if (mode === 'app') return { categories: current ? appModel(current) : [] };

    const groups: SettingsGroupHeading[] = [
      { id: ACCOUNT_GROUP, label: 'Account', icon: renderLogo('all') },
    ];
    const categories: SettingsCategory[] = groupCategories(
      ACCOUNT_GROUP,
      accountCategories({
        ...account,
        all: shared?.all ?? value.all,
        set: shared?.set ?? ((key, next) => saver.changeShared(key, next)),
      }),
    );
    for (const app of SETTINGS_APP_IDS) {
      const listed =
        own && app === current
          ? // The Account section holds the shared switches, so the app's copies of them are left out here.
            groupCategories(app, own, {
              omit: (row) => row.allApps === true && ACCOUNT_KEYS.has(row.key),
            })
          : groupCategories(app, appModel(app));
      if (listed.length === 0) continue;
      groups.push({ id: app, label: APP_NAMES[app], icon: renderLogo(app) });
      categories.push(...listed);
    }
    return { categories, groups };
  }, [mode, current, own, catalogues, value, shared, account, renderLogo, saver]);

  return (
    <SettingsView
      {...view}
      categories={model.categories}
      groups={model.groups}
      placeholder={
        model.categories.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
            Everything else is set in the app itself.
          </p>
        ) : undefined
      }
      footer={
        <>
          {footer}
          <p aria-live="polite" className="sr-only">
            {saved > 0 && !error ? 'Saved' : ''}
          </p>
          {error ? <ErrorNote>{errorMessage(error)}</ErrorNote> : null}
        </>
      }
    />
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
    >
      {children}
    </p>
  );
}

/** What the panel shows while its settings load. */
export function SettingsSkeleton() {
  return (
    <div aria-busy className="space-y-3 px-4 py-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70"
        />
      ))}
    </div>
  );
}
