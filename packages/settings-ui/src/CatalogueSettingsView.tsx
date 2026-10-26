'use client';

// The Settings panel's view over what it reads from the accounts API (liveworkspace/docs/specs/010-site/site.md "Settings"): one
// app's settings from its plain-data catalogue (liveworkspace.app, where no app's own Settings is loaded), or the
// All view: the Account section, then one set of categories, Common's and every app's merged by their place
// (merge-categories.ts), each app's own rows under its logo and name. Its own chunk, loaded only when
// one of those is first shown, with each app's catalogue fetched beside it; an editor showing its own settings
// never loads it.
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { ACCOUNT_KEYS } from '@liveworkspace/settings/account';
import type {
  AppCatalogue,
  CatalogueBinding,
  StoredValue,
} from '@liveworkspace/settings/catalogue';
import {
  commonCatalogue,
  withoutCommonRows,
  type CommonCatalogue,
} from '@liveworkspace/settings/common';
import { accountCategories, type AccountSection } from './account-model';
import { catalogueModel } from './catalogue-model';
import { foldIntoAccount } from './fold-account';
import { SettingsCategoryTile } from './glyphs';
import { guestProfileRows } from './profile/profile-rows';
import type { AccountGuest } from './profile/ProfileHeader';
import { COMMON_GROUP, commonModel, commonRowIds } from './common-model';
import { groupCategories } from './groups';
import { mergeAppCategories, type MergeSource } from './merge-categories';
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
// All's merged categories (merge-categories.ts), listed under the Account section with no heading of their own.
export const APPS_GROUP = 'apps';

export type AccountHost = Omit<AccountSection, 'all' | 'set'> & {
  // Where the host holds the `all` scope itself (an editor's preferences): read and written there rather than over
  // the accounts API.
  shared?: Pick<AccountSection, 'all' | 'set'>;
  // A guest (the app's side alone): their Profile, first, with the way to sign in.
  guest?: AccountGuest | null;
};

export type CatalogueSettingsViewProps = {
  mode: 'app' | 'all';
  // The app's own view also shows the Account section and the Common settings the app has, above the app's own
  // (signed in: they are the account's, and shape the app as much as its own settings do).
  withShared?: boolean;
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
  const { mode, current, own, withShared = false } = props;
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // The apps read here: just the one in its own view; in All every app but the one whose own Settings the host
  // already has.
  // With the shared ones, the app's view reads every app too: Common is the settings two or more apps have.
  const apps = useMemo(
    () =>
      mode === 'app' && !withShared
        ? current
          ? [current]
          : []
        : SETTINGS_APP_IDS.filter((app) => !(own && app === current)),
    [mode, current, own, withShared],
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
          // Every answer carries the `all` scope; the last one read is the newest. An answer without one leaves it.
          scopes.all = read.data.all ?? scopes.all;
        });
        setLoad({ state: 'ready', catalogues, scopes });
      },
      () => live && setLoad({ state: 'error', error: 'offline' }),
    );
    return () => {
      live = false;
    };
  }, [apps, store, attempt]);

  // An editor's own settings are drawn at once while the Account section and Common load beside them.
  if (load.state === 'loading' && mode === 'app' && own) {
    return <SettingsView {...view(props)} categories={own} memoryKey={props.memoryKey ?? null} />;
  }
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
  withShared = false,
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

  // The Common group's rows, from every catalogue read, in the apps' order: built once.
  const common = useMemo(
    () =>
      mode === 'all' || withShared
        ? commonCatalogue(
            SETTINGS_APP_IDS.flatMap((app) => {
              const catalogue = catalogues[app];
              return catalogue ? [{ app, catalogue }] : [];
            }),
          )
        : null,
    [mode, withShared, catalogues],
  );

  // Rebuilt only when what it reads changes, so a search keystroke keeps every row's identity (and the view's memo).
  const model = useMemo(
    () =>
      panelModel({
        mode,
        withShared,
        current,
        own,
        catalogues,
        common,
        value,
        account,
        renderLogo,
        saver,
      }),
    [mode, withShared, current, own, catalogues, common, value, account, renderLogo, saver],
  );

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

/** The panel's categories and the rail's headings: one app's (its side of the switch), or All's. Plain, so a test can
 *  read the whole of All for every app's catalogue. */
export function panelModel({
  mode,
  withShared = false,
  current,
  own,
  catalogues,
  common,
  value,
  account,
  renderLogo,
  saver,
}: {
  mode: 'app' | 'all';
  withShared?: boolean;
  current: SettingsAppId | null;
  own?: readonly SettingsCategory[] | undefined;
  catalogues: Partial<Record<SettingsAppId, AppCatalogue>>;
  common: CommonCatalogue | null;
  value: PanelScopes;
  account: AccountHost;
  renderLogo: (id: SettingsAppId | 'all') => ReactNode;
  saver: Pick<ScopesSaver, 'changeApp' | 'changeShared'>;
}): { categories: SettingsCategory[]; groups?: SettingsGroupHeading[] } {
  const { shared } = account;
  const appModel = (app: SettingsAppId, structure = false) => {
    const catalogue = catalogues[app];
    if (!catalogue) return [];
    return catalogueModel(
      // In All, an app's group holds only its own settings: the common ones are under Common.
      mode === 'all' || withShared ? withoutCommonRows(catalogue) : catalogue,
      { all: shared?.all ?? value.all, app: value.apps[app] ?? {} },
      (binding, stored) => saver.changeApp(app, binding, stored),
      { structure },
    );
  };
  if (mode === 'app' && !withShared) {
    const listed = current ? appModel(current) : [];
    return {
      categories: account.guest
        ? [
            {
              id: 'profile',
              label: 'Profile',
              icon: <SettingsCategoryTile id="account" />,
              rows: guestProfileRows(account.guest),
            },
            ...listed,
          ]
        : listed,
    };
  }

  const groups: SettingsGroupHeading[] = [
    { id: ACCOUNT_GROUP, label: 'Account', icon: renderLogo('all') },
  ];
  // The Account section's categories, which each app's own copies are folded into below, so it shows once.
  const accountListed: SettingsCategory[] = groupCategories(
    ACCOUNT_GROUP,
    accountCategories({
      ...account,
      all: shared?.all ?? value.all,
      set: shared?.set ?? ((key, next) => saver.changeShared(key, next)),
    }),
  );
  // An editor's own copies of the Account section's switches and of the common settings are left out of its
  // categories (a readout line pointing at a common row points under Common).
  const commonIds = common ? commonRowIds(common) : new Set<string>();
  const ownFiled = (app: SettingsAppId, keepEmpty: boolean) =>
    groupCategories(app, own ?? [], {
      omit: (row) => (row.allApps === true && ACCOUNT_KEYS.has(row.key)) || commonIds.has(row.key),
      groupOf: (rowKey) => (commonIds.has(rowKey) ? COMMON_GROUP : app),
      keepEmpty,
    });
  // An app's sub-heading inside a category: its logo and name.
  const heading = (app: SettingsAppId) => ({ label: APP_NAMES[app], icon: renderLogo(app) });
  // Common reads an app's old copy of a common setting from the app the panel was opened for first.
  const order = current
    ? [current, ...SETTINGS_APP_IDS.filter((app) => app !== current)]
    : SETTINGS_APP_IDS;

  if (mode === 'all') {
    // One set of categories (merge-categories.ts): Common's, then each app's own, the app opened for first, merged
    // by their place, each app's own rows under its logo and name.
    const sources: MergeSource[] = [];
    if (common) {
      sources.push({
        group: COMMON_GROUP,
        categories: commonModel({
          common,
          all: value.all,
          apps: value.apps,
          order,
          ...(own && shared ? { own: { categories: own, prefs: shared.all } } : {}),
          change: (app, binding, stored) => saver.changeApp(app, binding, stored),
          structure: true,
        }),
      });
    }
    for (const app of order) {
      const filed =
        own && app === current
          ? ownFiled(app, true)
          : groupCategories(app, appModel(app, true), { keepEmpty: true });
      sources.push({
        group: app,
        heading: heading(app),
        categories: foldIntoAccount({
          account: accountListed,
          accountGroup: ACCOUNT_GROUP,
          app: filed,
          appGroup: app,
          appHeading: heading(app),
        }),
      });
    }
    const merged = mergeAppCategories(sources, APPS_GROUP);
    if (merged.length > 0) groups.push({ id: APPS_GROUP, label: 'Apps', flat: true });
    return {
      // The Account section's categories answer to their bare ids too (`notifications`).
      categories: [
        ...accountListed.map((c) => ({
          ...c,
          aliases: [...(c.aliases ?? []), c.id.slice(ACCOUNT_GROUP.length + 1)],
        })),
        ...merged,
      ],
      groups,
    };
  }

  const categories: SettingsCategory[] = [];
  // The app's own view: Common's rows that app has, then its group alone.
  const shownCommon = common && current ? commonFor(common, current) : common;
  const shownApps = current ? [current] : [];
  if (shownCommon) {
    const listed = commonModel({
      common: shownCommon,
      all: value.all,
      apps: value.apps,
      order,
      ...(own && shared ? { own: { categories: own, prefs: shared.all } } : {}),
      change: (app, binding, stored) => saver.changeApp(app, binding, stored),
    });
    if (listed.length > 0) {
      groups.push({ id: COMMON_GROUP, label: 'Common', icon: renderLogo('all') });
      categories.push(...listed);
    }
  }
  for (const app of shownApps) {
    const filed =
      own && app === current ? ownFiled(app, false) : groupCategories(app, appModel(app));
    const listed = foldIntoAccount({
      account: accountListed,
      accountGroup: ACCOUNT_GROUP,
      app: filed,
      appGroup: app,
      appHeading: heading(app),
    });
    // An app left with no settings of its own is left out of the rail, rather than shown with a note.
    if (listed.length === 0) continue;
    groups.push({ id: app, label: APP_NAMES[app], icon: renderLogo(app) });
    categories.push(...listed);
  }
  return { categories: [...accountListed, ...categories], groups };
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

// The Common settings one app has: the rest don't touch it.
function commonFor(common: CommonCatalogue, app: SettingsAppId): CommonCatalogue {
  const has = (id: string) => common.apps.get(id)?.includes(app) ?? false;
  return {
    ...common,
    catalogue: {
      ...common.catalogue,
      categories: common.catalogue.categories
        .map((category) => ({ ...category, rows: category.rows.filter((row) => has(row.id)) }))
        .filter((category) => category.rows.length > 0),
    },
  };
}

// The SettingsView's own props, from the view's.
function view({
  isMobile,
  onClose,
  title,
  leading,
  footer,
  switcher,
  focus,
  initialCategoryId,
  initialSectionId,
  onCategoryOpened,
}: CatalogueSettingsViewProps) {
  return {
    isMobile,
    onClose,
    title,
    leading,
    footer,
    switcher,
    focus,
    initialCategoryId,
    initialSectionId,
    onCategoryOpened,
  };
}
