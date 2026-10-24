'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandMark, Dialog, lucideGlyph, useMediaQuery } from '@livediagram/ui';
import { lucideExternalLink } from '@livediagram/icons/lucide';
import type { StoredValue } from '@liveworkspace/settings/catalogue';
import {
  createDeviceSettingsStore,
  SETTINGS_DIALOG_CLASS,
  SETTINGS_DIALOG_SIZE,
  SettingsPanel,
  SettingsUiKitProvider,
  useSettingsScope,
  type AccountHost,
  type SettingsAppId,
  type SettingsScope,
} from '@liveworkspace/settings-ui';
import { APP_SITES, PLATFORM_SITE } from '@liveworkspace/sites';
import { accountApi } from '@/lib/account-api';
import { appSettingsLinks } from '@/lib/account-settings';
import { settingsStore, type AppId } from '@/lib/app-settings';
import { pageApp, workspaceHref } from '@/lib/explorer/page-app';
import { setExplorerConsent } from '@/lib/explorer/telemetry';
import { reportAppSetting, reportSharedSetting } from '@/lib/settings-telemetry';
import { APP_SETTINGS_KIT } from './app-settings-kit';
import { ProfileCard, type Profile } from './ProfileCard';
import { settingsErrorMessage } from './settings-ui';

const OutIcon = lucideGlyph(lucideExternalLink, 14);

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
  onClose,
}: {
  // A targeted open's side of the switch (`?app=all`, a `#notifications` link), else this browser's last.
  initialScope?: SettingsScope | null;
  initialCategoryId?: string | null;
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
  const link = app ? appSettingsLinks().find((l) => l.id === app) : undefined;
  // On an app's own address the page has the app's token, not this site's session: the profile and the API tokens
  // are set on liveworkspace.app, so they link there.
  const account = useMemo<AccountHost>(
    () =>
      pageApp()
        ? {
            profileHref: workspaceHref('/account/settings#profile'),
            tokensHref: workspaceHref('/account/tokens'),
          }
        : { renderProfile: () => <ProfileRow />, tokensHref: '/account/tokens' },
    [],
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

  const showsApp = Boolean(site) && (scope === 'app' || Boolean(guest));
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
          app={site && app ? { id: app, name: site.name } : null}
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
                {showsApp && site && link ? (
                  <a
                    href={link.href}
                    className="relative touch-target-y inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-200"
                  >
                    More in {site.name} Settings
                    <OutIcon aria-hidden className="size-3.5" />
                  </a>
                ) : null}
              </div>
            )
          }
        />
      </SettingsUiKitProvider>
    </Dialog>
  );
}

// The profile collaborators see, read once when its category is first shown (GET /api/account/profile).
function ProfileRow() {
  const [profile, setProfile] = useState<
    | { state: 'loading' }
    | { state: 'error'; error: string }
    | { state: 'ready'; profile: Profile | null }
  >({ state: 'loading' });
  useEffect(() => {
    let live = true;
    void accountApi<{ profile: Profile | null }>('/profile').then((result) => {
      if (!live) return;
      setProfile(
        result.ok
          ? { state: 'ready', profile: result.data.profile }
          : { state: 'error', error: result.error },
      );
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <div data-settings-cell="profile" className="px-4 py-4">
      {profile.state === 'loading' ? (
        <div
          aria-busy
          className="h-40 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70"
        />
      ) : profile.state === 'error' ? (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {settingsErrorMessage(profile.error)}
        </p>
      ) : (
        <ProfileCard initial={profile.profile} />
      )}
    </div>
  );
}
