'use client';

// The Explorer page: the shared Explorer (@liveworkspace/explorer, liveworkspace/docs/one-explorer.md) in livedesign's
// chrome: the header with the search field centred between the brand and the account, and the bottom bar with Search,
// Settings and Appearance. Everything it lists comes from the index (ExplorerHost). livedesign's own pages under
// /explorer sit in the same chrome and are linked from the sidebar's More group: This Browser (/offline, the designs
// kept only here) and the Image Gallery (/explorer/images, the person's images and the designs each is used in).

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { viewFromLocation, type SidebarLink } from '@liveworkspace/explorer';
import { Brand, SITE_ID, SiteSwitcher } from '@livedesign/ui';
import { AuthControls } from '@/components/chrome/AuthControls';
import { ChromeControls } from '@/components/chrome/ChromeControls';
import { SignInBanner, SIGNIN_BANNER_DISMISS_KEY } from '@/components/chrome/SignInBanner';
import { LocalMovePrompt } from '@/components/dialogs/LocalMovePrompt';
import { useDismissibleBanner } from '@/hooks/ui/useDismissibleBanner';
import { useSearchShortcut } from '@/hooks/ui/useSearchShortcut';
import { signInEnabled } from '@/lib/auth-config';
import { helpArticleHref } from '@/lib/help-articles';
import { isPowerUserMode } from '@/lib/power-user-mode';
import { dropSettingsLink, readSettingsLink } from '@/lib/settings-link';
import { commitUserPreferences } from '@/lib/user-preferences';
import {
  ExplorerHost,
  useExplorerChrome,
  type ExplorerChrome,
} from '../embed/workbench/ExplorerHost';

// Settings mount only while open, so they load on first open rather than with every Explorer page.
const SettingsDialog = dynamic(
  () => import('@/components/dialogs/SettingsDialog').then((m) => m.SettingsDialog),
  { ssr: false },
);
// The Image Gallery (docs/specs/009-elements/images.md): only its own page loads it.
const GalleryPane = dynamic(
  () => import('@/components/panels/GalleryPane').then((m) => m.GalleryPane),
  { ssr: false },
);

export const IMAGE_GALLERY_PATH = '/explorer/images';

const SIDEBAR_LINKS: readonly SidebarLink[] = [
  {
    id: 'offline',
    label: 'This Browser',
    href: '/offline',
    description: 'Designs kept only in this browser',
    icon: 'browser',
  },
  {
    id: 'images',
    label: 'Image Gallery',
    href: IMAGE_GALLERY_PATH,
    description: 'Your images, and the designs each is used in',
  },
];

// Search from the bottom bar or Cmd/Ctrl+K: the page's one search field, the header's or Home's hero's.
function focusSearch() {
  const field = document.querySelector<HTMLInputElement>('input[data-search-field]');
  field?.focus();
  field?.select();
}

function Header({ field, onOpenAccount }: { field: ReactNode; onOpenAccount: () => void }) {
  // On a desktop the header is three columns, the field centred between the brand and the account on every page;
  // each side grows to its content first. Below `sm` the field wraps onto its own full-width row.
  return (
    <header className="sticky top-0 z-[var(--z-chrome)] flex shrink-0 flex-wrap items-center justify-between gap-x-4 border-y border-slate-200 bg-white/85 pl-4 pr-0 backdrop-blur sm:h-14 sm:flex-nowrap lg:grid lg:grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] dark:border-slate-700 dark:bg-slate-900/85">
      <div className="flex h-14 items-center gap-3 lg:col-start-1">
        {/* Hover the logo for liveworkspace's other sites (liveworkspace/docs/site-switcher.md). */}
        <SiteSwitcher current={SITE_ID}>
          <Brand href="/" size="md" />
        </SiteSwitcher>
      </div>
      {/* While Home shows its hero the field sits there instead, so the page never has two. */}
      {field ? (
        <div className="order-last w-full pb-2 pr-4 sm:order-none sm:ml-auto sm:w-auto sm:pb-0 sm:pr-0 lg:col-start-2 lg:ml-0">
          {field}
        </div>
      ) : null}
      <div className="flex h-14 items-stretch lg:col-start-3 lg:justify-self-end">
        <AuthControls onOpenAccount={onOpenAccount} />
      </div>
    </header>
  );
}

export function ExplorerShell() {
  const pathname = usePathname();
  const search = useSearchParams();
  const view = viewFromLocation(pathname, search);
  const onGallery = pathname.replace(/\/+$/, '') === IMAGE_GALLERY_PATH;
  // Opens on the Settings deep link (`?settings=<category>`, lib/settings-link.ts) that mail and the account menu use.
  const [settings, setSettings] = useState<{
    category: string | null;
    section: string | null;
  } | null>(() => readSettingsLink(search.toString()));
  useSearchShortcut(focusSearch);
  const openAccount = () => setSettings({ category: 'account', section: null });

  const bottom = ({ prefs, ownerId, signedIn }: ExplorerChrome) => (
    <>
      <GuestSignInBanner signedIn={signedIn} />
      {/* The bottom bar (docs/specs/007-editor/editor-app.md): the editor's right-hand controls, Search, Settings
          and Appearance. The toasts stand on it (docs/specs/004-interface-design/toasts.md). */}
      <div
        data-toast-floor=""
        className="sticky bottom-0 z-[var(--z-chrome)] flex h-12 shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <ChromeControls
          onOpenSearch={focusSearch}
          onOpenSettings={() => setSettings({ category: null, section: null })}
          powerUser={isPowerUserMode(prefs)}
        />
      </div>
      {settings ? (
        <SettingsDialog
          settings={prefs}
          onChange={(next) => {
            // The row built `next` on this render's preferences; only its change is written, onto the freshest,
            // so another tab's change since is kept.
            commitUserPreferences(prefs, next, ownerId);
          }}
          onClose={() => {
            setSettings(null);
            dropSettingsLink();
          }}
          initialCategoryId={settings.category}
          initialSectionId={settings.section}
        />
      ) : null}
    </>
  );

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-900">
      {onGallery ? (
        <GalleryPage header={<Header field={null} onOpenAccount={openAccount} />} bottom={bottom} />
      ) : (
        <ExplorerHost
          view={view}
          sidebarLinks={SIDEBAR_LINKS}
          header={(field) => <Header field={field} onOpenAccount={openAccount} />}
        >
          {bottom}
        </ExplorerHost>
      )}
      {/* Moving this browser's designs off This Browser after signing in
          (docs/specs/014-identity/auth-and-guest-access.md). */}
      <LocalMovePrompt />
    </div>
  );
}

// The Image Gallery page: the person's images with the designs each is used in, upload and delete
// (docs/specs/009-elements/images.md), in the Explorer's chrome with a way back to it.
function GalleryPage({
  header,
  bottom,
}: {
  header: ReactNode;
  bottom: (chrome: ExplorerChrome) => ReactNode;
}) {
  const { chrome } = useExplorerChrome();
  const { ownerId } = chrome;
  return (
    <>
      {header}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6">
        <nav className="mb-4 text-sm">
          <Link href="/explorer" className="text-brand-700 hover:underline dark:text-brand-300">
            Explorer
          </Link>
          <span className="text-slate-400"> › </span>
          <span className="text-slate-700 dark:text-slate-200">Image Gallery</span>
        </nav>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            Image Gallery
          </h1>
          <a
            href={helpArticleHref('imageGallery')}
            className="text-sm text-brand-700 hover:underline dark:text-brand-300"
          >
            Help
          </a>
        </div>
        {ownerId ? (
          <GalleryPane ownerId={ownerId} />
        ) : (
          <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
            Opening your images…
          </p>
        )}
      </main>
      {bottom(chrome)}
    </>
  );
}

// The guest's sign-in banner (docs/specs/014-identity/sign-in-encouragement.md): a floating card over the bottom bar,
// only where sign-in is wired up, for a visitor not signed in who has not closed it.
function GuestSignInBanner({ signedIn }: { signedIn: boolean }) {
  const { dismissed, dismiss } = useDismissibleBanner(SIGNIN_BANNER_DISMISS_KEY);
  if (!signInEnabled || signedIn || dismissed) return null;
  return (
    <>
      <div aria-hidden className="h-28 shrink-0 sm:h-12" />
      <SignInBanner surface="Explorer" onDismiss={dismiss} />
    </>
  );
}
