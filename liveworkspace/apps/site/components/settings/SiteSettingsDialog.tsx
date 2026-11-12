'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandMark } from '@livediagram/ui';
import { Dialog, useMediaQuery } from '@liveworkspace/ui';
import type { StoredValue } from '@liveworkspace/settings/catalogue';
import {
  accountPanels,
  bearerAccountSecurity,
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
import { pageApp } from '@/lib/explorer/page-app';
import { setExplorerConsent, setGuestTelemetryChoice } from '@/lib/explorer/telemetry';
import { reportAppSetting, reportSharedSetting } from '@/lib/settings-telemetry';
import { APP_SETTINGS_KIT } from './app-settings-kit';
import { siteSettingsHeroArt } from './SiteSettingsHeroArt';
import { settingsErrorMessage } from './settings-ui';

// The Account section's API Tokens and Download Your Data (@liveworkspace/settings-ui accountPanels), each
// fetched when its category is first shown: the account API through accountApi (this site's session on
// liveworkspace.app, the app's token through its router on an app's address).
const ACCOUNT_PANELS = accountPanels({ request: accountApi });

// Sign-in and devices on an app's address: the account API's bearer door, through the app's router.
const APP_SECURITY = bearerAccountSecurity(accountApi, { settingsParam: 'profile' });

// The apps' phone layout: narrower than `sm`, or a touch screen under 500px tall (each editor's
// PHONE_MEDIA_QUERY).
const PHONE_QUERY = '(max-width: 639px), (pointer: coarse) and (max-height: 499px)';

// Each app's prism in its accent, and liveworkspace's own for All and the Account section, as the Explorer's filter.
const renderLogo = (id: SettingsAppId | 'all') => (
  <BrandMark
    accentColor={
      id === 'all' ? PLATFORM_SITE.accent : (APP_SITES.find((s) => s.id === id)?.accent ?? '')
    }
  />
);

// The Settings panel over a page of this site (liveworkspace/docs/specs/010-site/site.md "Settings"): the one panel every app's
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
  const [scope, setScope] = useSettingsScope(initialScope);
  const site = app ? APP_SITES.find((s) => s.id === app) : undefined;
  // The Profile's header is whoever is signed in here. Everything in the Account section is edited in place on either
  // address: over this site's session on liveworkspace.app, over the app's token on an app's own (accountApi goes
  // through the app's router there, and sign-in and devices through the account API's bearer door).
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
              security: APP_SECURITY,
              ...ACCOUNT_PANELS,
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
              ...ACCOUNT_PANELS,
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
      if (key === 'telemetryEnabled')
        void reported.then(() =>
          isGuest ? setGuestTelemetryChoice(value !== false) : setExplorerConsent(value !== false),
        );
      return reported;
    },
    [app, isGuest],
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
          // One account, every app: liveworkspace.app's own band (site.md "Settings").
          heroArt={siteSettingsHeroArt}
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
      return app
        ? {
            name: app.fullName ?? app.name,
            email: app.email,
            colour: app.colour,
            picture: app.picture,
          }
        : null;
    }
    return session.state === 'in'
      ? {
          name: session.fullName ?? session.name,
          email: session.email ?? null,
          colour: session.colour,
          picture: session.picture,
          joined: session.joined ?? null,
        }
      : null;
  }, [app, session]);
}
