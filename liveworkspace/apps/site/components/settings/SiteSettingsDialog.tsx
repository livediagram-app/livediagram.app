'use client';

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BrandMark } from '@livediagram/ui';
import { Dialog, useMediaQuery } from '@liveworkspace/ui';
import type { StoredValue } from '@liveworkspace/settings/catalogue';
import {
  createDeviceSettingsStore,
  requestProfileHost,
  SETTINGS_DIALOG_CLASS,
  SETTINGS_DIALOG_SIZE,
  SettingsPanel,
  settingsPanelApp,
  SettingsUiKitProvider,
  useCloudSync,
  useSettingsScope,
  type AccountHost,
  type AccountIdentity,
  type ProfileHost,
  type SettingsAppId,
  type SettingsScope,
} from '@liveworkspace/settings-ui';
import { APP_SITES, PLATFORM_SITE } from '@liveworkspace/sites';
import { accountApi } from '@/lib/account-api';
import { accountSecurity } from '@/lib/account-security';
import { cloudSyncHost } from '@/lib/drive/client';
import {
  appAccount,
  onAppAccountChange,
  setAppAccountColour,
  type AppAccount,
} from '@/lib/explorer/app-session';
import { setSessionColour, signOut, useSession } from '@/lib/session';
import { settingsStore, type AppId } from '@/lib/app-settings';
import { pageApp, workspaceHref } from '@/lib/explorer/page-app';
import { setExplorerConsent } from '@/lib/explorer/telemetry';
import { reportAppSetting, reportSharedSetting } from '@/lib/settings-telemetry';
import { APP_SETTINGS_KIT } from './app-settings-kit';
import { settingsErrorMessage } from './settings-ui';

// The API Tokens category's own code: fetched when it is first shown, not with the panel.
const TokensPanel = lazy(() => import('./TokensPanel').then((m) => ({ default: m.TokensPanel })));

// The apps' phone layout: narrower than `sm`, or a touch screen under 500px tall (each editor's
// PHONE_MEDIA_QUERY).
const PHONE_QUERY = '(max-width: 639px), (pointer: coarse) and (max-height: 499px)';

// Which side of the switch this browser last chose, as each editor keeps its own.
const SCOPE_KEY = 'liveworkspace:settings-scope:v1';

// Each app's prism in its accent, and liveworkspace's own for All and the Account section, as the Explorer's filter.
const renderLogo = (id: SettingsAppId | 'all') => (
  <BrandMark
    accentColor={
      id === 'all' ? PLATFORM_SITE.accent : (APP_SITES.find((s) => s.id === id)?.accent ?? '')
    }
  />
);

// The Settings panel over a page of this site (liveworkspace/docs/site.md "Settings"): the one panel every app's
// Settings renders (@liveworkspace/settings-ui SettingsPanel), opened for the app the person came from (its settings,
// with All one click away) or for none (All). Its code, and each app's catalogue, load only when it first opens or
// the pointer heads for Settings. Escape, the close button or a click outside closes it.
//
// For a guest (`guest`, the Explorer on an app's address): that app's settings alone, as its editor keeps them in this
// browser (a device store over the app's own storage on this origin), with no switch, no All and no Account section,
// and a footer that says so and offers Sign in.
export default function SiteSettingsDialog({
  app,
  guest = null,
  initialScope = null,
  initialCategoryId = null,
  initialSectionId = null,
  onClose,
}: {
  // A targeted open's side of the switch (`?app=all`, a `#notifications` link), else this browser's last.
  initialScope?: SettingsScope | null;
  initialCategoryId?: string | null;
  // A section of that category to scroll to (`&section=cloud-sync`, Cloud Sync's way back from Google).
  initialSectionId?: string | null;
  onClose: () => void;
} & (
  | { app: AppId | null; guest?: null }
  | {
      app: AppId;
      // The guest: their id (`guest_<uuid>`, the owner the app's editor syncs as) and where Sign in goes.
      guest: { ownerId: string | null; signInHref: string };
    }
)) {
  const isMobile = useMediaQuery(PHONE_QUERY);
  const [scope, setScope] = useSettingsScope(SCOPE_KEY, initialScope);
  const site = app ? APP_SITES.find((s) => s.id === app) : undefined;
  // The Profile's header is whoever is signed in here. Its Name and Colour is edited in place on either address: over
  // this site's session on liveworkspace.app, over the app's token on an app's own (accountApi goes through the app's
  // router there). Sessions, sign-in methods and the API tokens are liveworkspace.app's session's, so on an app's
  // address they link to the panel there, on the same category.
  const identity = useSettingsIdentity();
  const guestSignIn = guest?.signInHref ?? null;
  const accountName = identity?.name ?? '';
  const profile = useMemo<ProfileHost>(
    () =>
      requestProfileHost(accountApi, {
        accountName,
        onColour: pageApp() ? setAppAccountColour : setSessionColour,
        errorMessage: settingsErrorMessage,
      }),
    [accountName],
  );
  // Cloud Sync, for an account: its section shows once the Drive service says the deployment offers it.
  const cloudSyncFor = useMemo(() => (guestSignIn ? null : cloudSyncHost()), [guestSignIn]);
  const cloudSync = useCloudSync(cloudSyncFor);
  const account = useMemo<AccountHost>(
    () =>
      guestSignIn
        ? { guest: { signInHref: guestSignIn, things: 'work' } }
        : pageApp()
          ? {
              identity,
              profile,
              cloudSync,
              securityHref: workspaceHref('/explorer?settings=profile'),
              tokensHref: workspaceHref('/explorer?settings=tokens'),
            }
          : {
              identity,
              profile,
              cloudSync,
              security: accountSecurity,
              onSignOut: async () => {
                const left = await signOut();
                if (left) window.location.assign('/');
                return left;
              },
              renderTokens: () => <TokensRow />,
            },
    [identity, guestSignIn, profile, cloudSync],
  );
  // A guest's: the browser copy the app's editor keeps, made once per opening.
  const isGuest = guest !== null;
  const guestOwner = guest?.ownerId ?? null;
  const store = useMemo(
    () =>
      isGuest && app
        ? createDeviceSettingsStore(app, { ownerId: () => guestOwner })
        : settingsStore,
    [isGuest, app, guestOwner],
  );
  const reportShared = useCallback(
    (key: string, value: StoredValue) => {
      const reported = reportSharedSetting(key, value === true, app);
      // Turning telemetry off waits for its own opt-out to be handed over.
      if (key === 'telemetryEnabled') void reported.then(() => setExplorerConsent(value !== false));
      return reported;
    },
    [app],
  );

  // The page behind the dialog holds still.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Settings"
      size={SETTINGS_DIALOG_SIZE}
      initialFocus="container"
      className={SETTINGS_DIALOG_CLASS}
    >
      <SettingsUiKitProvider kit={APP_SETTINGS_KIT}>
        <SettingsPanel
          app={site && app ? settingsPanelApp({ ...site, id: app }) : null}
          scope={guest ? 'app' : scope}
          onScopeChange={setScope}
          allowAll={!guest}
          store={store}
          account={account}
          renderLogo={renderLogo}
          reportApp={reportAppSetting}
          reportShared={reportShared}
          {...(guest ? {} : { errorMessage: settingsErrorMessage })}
          memoryKey={
            site
              ? `liveworkspace:app-settings-view:${site.name}:v1`
              : 'liveworkspace:settings-view:v1'
          }
          initialCategoryId={initialCategoryId}
          initialSectionId={initialSectionId}
          isMobile={isMobile}
          onClose={onClose}
          title="Settings"
          footer={
            guest ? (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 flex-1 basis-56 text-[10px] text-slate-500 dark:text-slate-400">
                  Saved in this browser as you change them. {site?.name ?? 'The app'} uses them the
                  next time it opens.
                </p>
                <a
                  href={guest.signInHref}
                  data-settings-sign-in=""
                  className="relative touch-target-y inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-200"
                >
                  Sign in to keep them on every device
                </a>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 flex-1 basis-56 text-[10px] text-slate-500 dark:text-slate-400">
                  Saved to your account as you change them. Each app uses them the next time it
                  opens.
                </p>
              </div>
            )
          }
        />
      </SettingsUiKitProvider>
    </Dialog>
  );
}

// The API tokens (making one, its secret shown once, revoking one), drawn in the panel on liveworkspace.app: their code
// is its own chunk, fetched when the category is first shown, and they read GET /api/account/tokens then.
function TokensRow() {
  return (
    <div data-settings-cell="tokens" className="px-4 py-4">
      <Suspense
        fallback={
          <div
            aria-busy
            className="h-40 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70"
          />
        }
      >
        <TokensPanel />
      </Suspense>
    </div>
  );
}

// Who the Profile's header shows: liveworkspace.app's session here, the app's own on an app's address.
function useSettingsIdentity(): AccountIdentity | null {
  const session = useSession();
  const [app, setApp] = useState<AppAccount | null>(null);
  useEffect(() => {
    if (!pageApp()) return;
    let live = true;
    const read = () =>
      void appAccount().then((found) => {
        if (live) setApp(found);
      });
    read();
    // A colour just picked in the Profile repaints its header card at once.
    const stop = onAppAccountChange(read);
    return () => {
      live = false;
      stop();
    };
  }, []);
  return useMemo(() => {
    if (pageApp()) {
      return app ? { name: app.fullName ?? app.name, email: app.email, colour: app.colour } : null;
    }
    return session.state === 'in'
      ? {
          name: session.fullName ?? session.name,
          email: session.email ?? null,
          colour: session.colour,
          joined: session.joined ?? null,
        }
      : null;
  }, [app, session]);
}
