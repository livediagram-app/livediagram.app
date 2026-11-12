'use client';

// The Settings panel's view over what it reads from the accounts API (liveworkspace/docs/specs/010-site/site.md "Settings"): one
// app's settings from its plain-data catalogue (liveworkspace.app, where no app's own Settings is loaded), or the
// All view: one flat list of categories, Profile, then Common's and every app's merged by their place
// (merge-categories.ts), then the rest of the account's, each row marked with the logos of the apps it applies to;
// signed in, the app's side is the same, kept to the rows that apply to it, with no logos. Its own chunk, loaded only when
// one of those is first shown, with each app's catalogue fetched beside it; an editor showing its own settings
// never loads it.
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import type { HeroArt } from '@liveworkspace/ui/dialog-hero';
import type {
  AppCatalogue,
  CatalogueBinding,
  StoredValue,
} from '@liveworkspace/settings/catalogue';
import { commonCatalogue } from '@liveworkspace/settings/common';
import { AccountTokensInPlace } from './account-panels/tokens-in-place';
import { SettingsAppMarksProvider, type SettingsAppMarks } from './app-marks';
import type { SettingsCategory } from './model';
import { createScopesSaver, type PanelScopes, type ScopesSaver } from './saver';
import {
  loadAppCatalogue,
  panelAppIds,
  settingsApiErrorMessage,
  storeFor,
  type SettingsAppId,
  type SettingsRequest,
  type SettingsStore,
} from './store';
import { SettingsView, type SettingsFocus } from './SettingsView';
import type { PhoneHost } from './push/phone-host';
import { type AccountHost, panelModel } from './catalogue-panel-model';
export {
  type AccountHost,
  ACCOUNT_GROUP,
  APPS_GROUP,
  DEVELOPERS_GROUP,
  panelModel,
} from './catalogue-panel-model';

// The apps by name, for the All view's headings.
const APP_NAMES: Record<SettingsAppId, string> = {
  'livediagram.app': 'livediagram',
  'liveplanner.app': 'liveplanner',
  'livedocuments.app': 'livedocuments',
  'livedesign.app': 'livedesign',
  'livehuddle.app': 'livehuddle',
};

// The Phone section's host: the panel's request, and the app it opened in, shown beside the device it registers
// (liveworkspace on liveworkspace.app). Kept per request, so the section keeps its identity across renders.
const phoneHosts = new WeakMap<object, Map<string, PhoneHost>>();
function phoneHost(request: SettingsRequest, current: SettingsAppId | null): PhoneHost {
  const app = current ? (APP_NAMES[current] as PhoneHost['app']) : 'liveworkspace';
  let byApp = phoneHosts.get(request);
  if (!byApp) phoneHosts.set(request, (byApp = new Map()));
  let host = byApp.get(app);
  if (!host) byApp.set(app, (host = { request, app }));
  return host;
}

export type CatalogueSettingsViewProps = {
  mode: 'app' | 'all';
  // The app's own view also shows the account's categories and the Common settings the app has, beside the app's own
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
  subtitle?: string;
  heroArt?: HeroArt;
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
  // already has (a held app's own panel adds it: panelAppIds).
  // With the shared ones, the app's view reads every app too: Common is the settings two or more apps have.
  const apps = useMemo(
    () =>
      mode === 'app' && !withShared
        ? current
          ? [current]
          : []
        : panelAppIds(current).filter((app) => !(own && app === current)),
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

  const retry = () => {
    setLoad({ state: 'loading' });
    setAttempt((n) => n + 1);
  };
  // An editor's own settings are drawn at once while the account's and Common load beside them, and stay when that
  // read fails: only the account's and the shared parts are missing, so the note and Try again say so below them.
  // The app's side draws no logos (only All does), so nothing shifts when the rest arrives.
  if (load.state !== 'ready' && mode === 'app' && own) {
    return (
      <SettingsView
        {...view(props)}
        categories={own}
        memoryKey={props.memoryKey ?? null}
        footer={
          load.state === 'error' ? (
            <>
              {props.footer}
              <ReadFailed message={errorMessage(load.error)} onRetry={retry} />
            </>
          ) : (
            props.footer
          )
        }
      />
    );
  }
  if (load.state !== 'ready') {
    return (
      <SettingsView
        categories={[]}
        isMobile={props.isMobile}
        onClose={props.onClose}
        title={props.title}
        subtitle={props.subtitle}
        heroArt={props.heroArt}
        switcher={props.switcher}
        footer={props.footer}
        placeholder={
          load.state === 'error' ? (
            <div className="px-4 py-4">
              <ReadFailed message={errorMessage(load.error)} onRetry={retry} />
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

  // The common settings, from every catalogue read, in the apps' order: built once.
  const common = useMemo(
    () =>
      mode === 'all' || withShared
        ? commonCatalogue(
            panelAppIds(current).flatMap((app) => {
              const catalogue = catalogues[app];
              return catalogue ? [{ app, catalogue }] : [];
            }),
          )
        : null,
    [mode, withShared, current, catalogues],
  );

  // Phone notifications over the panel's own door (liveworkspace/docs/specs/003-accounts/push.md "Settings"), unless
  // the host hands in its own: signed in only, gated as API Tokens are (a host offers tokens only to an account).
  const withPhone = useMemo<AccountHost>(
    () =>
      account.phone !== undefined || account.guest || !account.renderTokens
        ? account
        : { ...account, phone: phoneHost(store.request, current) },
    [account, store, current],
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
        account: withPhone,
        saver,
      }),
    [mode, withShared, current, own, catalogues, common, value, withPhone, saver],
  );

  // The apps' logos beside each row, under All only: on the app's side every row shown applies to that app, so it
  // draws none and keeps no column for them.
  const marks = useAppMarks(mode === 'all' ? current : undefined, renderLogo);

  return (
    // An editor's own API Tokens row, folded into the account's, reads whether the tokens are drawn above.
    <AccountTokensInPlace value={Boolean(account.renderTokens)}>
      <SettingsAppMarksProvider value={marks}>
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
      </SettingsAppMarksProvider>
    </AccountTokensInPlace>
  );
}

/** The panel's apps, their names and logos, for the logos beside each row; null for one app's settings alone
 *  (`current` undefined). Built once per panel. */
function useAppMarks(
  current: SettingsAppId | null | undefined,
  renderLogo: (id: SettingsAppId | 'all') => ReactNode,
): SettingsAppMarks | null {
  return useMemo(
    () =>
      current === undefined
        ? null
        : {
            apps: panelAppIds(current).map((id) => ({
              id,
              name: APP_NAMES[id],
              logo: renderLogo(id),
            })),
            every: renderLogo('all'),
          },
    [current, renderLogo],
  );
}
// A read of the account's settings that failed: what went wrong, and the way to ask again.
function ReadFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      <ErrorNote>{message}</ErrorNote>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 cursor-pointer text-sm font-semibold text-slate-900 underline underline-offset-2 dark:text-white"
      >
        Try again
      </button>
    </>
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

// The SettingsView's own props, from the view's.
function view({
  isMobile,
  onClose,
  title,
  subtitle,
  heroArt,
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
    subtitle,
    heroArt,
    footer,
    switcher,
    focus,
    initialCategoryId,
    initialSectionId,
    onCategoryOpened,
  };
}
