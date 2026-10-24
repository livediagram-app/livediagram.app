'use client';

import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Dialog, lucideGlyph, useMediaQuery } from '@livediagram/ui';
import { lucideExternalLink } from '@livediagram/icons/lucide';
import type { AppCatalogue } from '@liveworkspace/settings/catalogue';
import { SettingsUiKitProvider, SettingsView } from '@liveworkspace/settings-ui';
import { loadAppScopes, loadCatalogue, type AppId, type AppScopes } from '@/lib/app-settings';
import { appSettingsModel } from '@/lib/app-settings-model';
import { createAppSettingsSaver } from '@/lib/app-settings-saver';
import type { ListedApp } from '@/lib/apps';
import { AppMark } from '../landing/AppLogo';
import { ErrorNote } from './AccountShell';
import { APP_SETTINGS_KIT } from './app-settings-kit';
import { settingsErrorMessage, useSavedFlash } from './settings-ui';

const OutIcon = lucideGlyph(lucideExternalLink, 14);

// The apps' phone layout: narrower than `sm`, or a touch screen under 500px tall (each editor's
// PHONE_MEDIA_QUERY).
const PHONE_QUERY = '(max-width: 639px), (pointer: coarse) and (max-height: 499px)';

type Load =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'ready'; catalogue: AppCatalogue };

// The front screen's framing: the app's name and mark, and the way to the rest of its Settings.
type Frame = {
  title: string;
  leading?: ReactNode;
  isMobile: boolean;
  onClose: () => void;
  more?: ReactNode;
};

// One app's own settings, in a dialog over the settings page (liveworkspace/docs/site.md "Your
// account"): the settings in the app's scope, in the same Settings view the app itself shows
// (@liveworkspace/settings-ui), each saved as it changes. The app's catalogue and settings are read
// once when the dialog first opens and kept for the page's lifetime. Escape, the close button or a
// click outside closes it; Tab stays inside while it is open, and the page gives focus back to the
// card.
export default function AppSettingsDialog({
  app,
  settingsHref,
  onClose,
}: {
  app: ListedApp & { id: AppId };
  settingsHref: string;
  onClose: () => void;
}) {
  const isMobile = useMediaQuery(PHONE_QUERY);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [value, setValue] = useState<AppScopes | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void Promise.all([loadCatalogue(app.id), loadAppScopes(app.id)]).then(
      ([catalogue, scopes]) => {
        if (!live) return;
        if (!scopes.ok) return setLoad({ state: 'error', error: scopes.error });
        setValue(scopes.data);
        setLoad({ state: 'ready', catalogue });
      },
      () => live && setLoad({ state: 'error', error: 'offline' }),
    );
    return () => {
      live = false;
    };
  }, [app.id, attempt]);

  // The page behind the dialog holds still.
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const frame: Frame = {
    title: `${app.name} Settings`,
    leading: <AppMark app={app} className="size-6 shrink-0" />,
    isMobile,
    onClose,
    more: (
      <a
        href={settingsHref}
        className="relative touch-target-y inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-700 underline-offset-2 hover:underline dark:text-slate-200"
      >
        More in {app.name} Settings
        <OutIcon aria-hidden className="size-3.5" />
      </a>
    ),
  };

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={frame.title}
      // The apps' Settings frame (each editor's SettingsDialog): the rail plus a readable pane, one
      // fixed height on desktop, the whole screen on a phone.
      size="2xl"
      initialFocus="container"
      className="max-h-[calc(100%-2rem)] sm:h-[min(42rem,calc(100%-6rem))] sm:max-h-[min(42rem,calc(100%-6rem))]"
    >
      <SettingsUiKitProvider kit={APP_SETTINGS_KIT}>
        {load.state === 'ready' && value ? (
          <AppSettingsBody
            app={app.id}
            catalogue={load.catalogue}
            value={value}
            onValue={setValue}
            {...frame}
          />
        ) : (
          <SettingsView
            categories={[]}
            isMobile={isMobile}
            onClose={onClose}
            title={frame.title}
            leading={frame.leading}
            placeholder={
              load.state === 'error' ? (
                <div className="px-4 py-4">
                  <ErrorNote>{settingsErrorMessage(load.error)}</ErrorNote>
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
                <Skeleton />
              )
            }
            footer={<Footer app={app.name} more={frame.more} />}
          />
        )}
      </SettingsUiKitProvider>
    </Dialog>
  );
}

function Footer({ app, more, children }: { app: string; more?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 flex-1 basis-56 text-[10px] text-slate-500 dark:text-slate-400">
          Saved to your account as you change them. {app} uses them the next time it opens.
        </p>
        {more}
      </div>
      {children}
    </>
  );
}

function Skeleton() {
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

// The app's categories and their rows, in the shared Settings view, each change saved as it is made
// (lib/app-settings-saver.ts).
export function AppSettingsBody({
  app,
  catalogue,
  value,
  onValue,
  title = 'Settings',
  leading,
  isMobile = false,
  onClose = () => {},
  more,
}: {
  app: AppId;
  catalogue: AppCatalogue;
  value: AppScopes;
  onValue: (next: AppScopes) => void;
} & Partial<Frame>) {
  const [error, setError] = useState<string | null>(null);
  const [saved, flashSaved] = useSavedFlash();
  const [saver] = useState(() => createAppSettingsSaver(app, value));
  useLayoutEffect(() => {
    saver.connect({ show: onValue, error: setError, saved: flashSaved });
  }, [saver, onValue, flashSaved]);

  // Rebuilt only when the stored values change, so a search keystroke keeps every row's identity
  // (and the view's memo).
  const categories = useMemo(
    () => appSettingsModel(catalogue, value, saver.change),
    [catalogue, value, saver],
  );
  const appName = app.replace(/\.app$/, '');

  return (
    <SettingsView
      categories={categories}
      isMobile={isMobile}
      onClose={onClose}
      title={title}
      leading={leading}
      placeholder={
        categories.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
            Everything else is set in the app itself.
          </p>
        ) : undefined
      }
      memoryKey={`liveworkspace:app-settings-view:${appName}:v1`}
      footer={
        <Footer app={appName} more={more}>
          <p aria-live="polite" className="sr-only">
            {saved ? 'Saved' : ''}
          </p>
          {error && <ErrorNote>{settingsErrorMessage(error)}</ErrorNote>}
        </Footer>
      }
    />
  );
}
