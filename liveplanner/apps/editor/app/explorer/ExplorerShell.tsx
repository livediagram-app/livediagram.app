'use client';

// The Explorer page: the shared Explorer (@liveworkspace/explorer, liveworkspace/docs/one-explorer.md) under
// liveplanner's header. Everything it lists comes from the index through /api/index; liveplanner supplies the
// addresses (lib/explorer-host.ts), New (the /new flow), and the person: an account's teams from its token, or a
// guest's identity from liveworkspace, which the first visit fetches before the Explorer asks for anything.

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Explorer, viewFromLocation, type ExplorerView } from '@liveworkspace/explorer';
import { Brand, SITE_ID, SiteSwitcher } from '@liveplanner/ui';
import { AuthControls } from '@/components/chrome/AuthControls';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useSignedGuestId } from '@/hooks/persistence/useSignedGuestId';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';
import { manageTeamsUrl } from '@/lib/auth-config';
import { indexClient } from '@/lib/index-client';
import { itemHref, newPlanHref, shareUrl, useTokenTeams } from '@/lib/explorer-host';

// The Explorer for the person, in whatever frame holds it: the /explorer pages (ExplorerShell) or a workbench's
// workspace frame (app/embed/workbench/WorkspaceFrame.tsx), which names the view itself and catches the Explorer's
// moves through the app's navigation interceptor.
export function ExplorerHost({ view }: { view: ExplorerView }) {
  const router = useAppNavigation();
  const { isSignedIn, authLoaded, accountUserId } = useAccountBootstrap();
  const guestId = useSignedGuestId(authLoaded, accountUserId);
  const teams = useTokenTeams(isSignedIn);
  const viewerId = accountUserId ?? guestId;
  // The Explorer asks the index as the person, so it waits until there is one.
  if (!viewerId)
    return (
      <p role="status" className="m-auto text-sm text-slate-500 dark:text-slate-400">
        Opening your Explorer…
      </p>
    );
  return (
    <Explorer
      app="liveplanner"
      client={indexClient}
      view={view}
      onNavigate={(_view, href) => router.push(href)}
      itemHref={itemHref}
      onCreate={(placement) => router.push(newPlanHref(placement))}
      onOpenItem={(href) => (href.startsWith('/') ? router.push(href) : window.location.assign(href))}
      Link={Link}
      teams={teams}
      viewerId={viewerId}
      shareUrl={shareUrl}
      manageTeamsUrl={isSignedIn ? manageTeamsUrl : undefined}
    />
  );
}

export function ExplorerShell() {
  const pathname = usePathname();
  const search = useSearchParams();
  const view = viewFromLocation(pathname, search);

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-900">
      <header className="sticky top-0 z-[var(--z-chrome)] flex h-14 shrink-0 items-center justify-between gap-x-4 border-y border-slate-200 bg-white/85 pl-4 pr-0 backdrop-blur dark:border-slate-700 dark:bg-slate-900/85">
        <div className="flex h-14 items-center gap-3">
          {/* Hover the logo for liveworkspace's other sites (liveworkspace/docs/site-switcher.md). */}
          <SiteSwitcher current={SITE_ID}>
            <Brand href="/" size="md" />
          </SiteSwitcher>
        </div>
        <div className="flex h-14 items-stretch">
          <AuthControls />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6">
        <ExplorerHost view={view} />
      </main>
    </div>
  );
}
