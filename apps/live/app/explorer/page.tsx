'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Brand } from '@livediagram/ui';
import { AuthControls } from '@/components/AuthControls';
import { useClerkApiBootstrap } from '@/hooks/useClerkApiBootstrap';
import {
  apiDismissSharedWith,
  apiListDiagrams,
  apiListFolders,
  apiListSharedWith,
  type Folder,
  type SharedWithItem,
} from '@/lib/api-client';
import { clerkEnabled } from '@/lib/clerk-config';
import { formatRelativeTime, useRelativeTimeTick } from '@/lib/relative-time';

type DiagramItem = { id: string; name: string; folderId: string | null; savedAt: number };

// Full-page Explorer (item #12). Signed-in only — guests still have
// the floating Explorer panel on the editor / new-diagram routes,
// but the standalone page is gated on Clerk because the value of
// the dedicated page is "see everything I own across devices," and
// pure-guest identity is per-browser by definition. The non-Clerk
// deployment renders a permanent "auth not configured" notice (per
// spec/04's three-deployment-modes table).
export default function ExplorerPage() {
  const { authLoaded, isSignedIn, clerkUserId, clerkDisplayName } = useClerkApiBootstrap();
  const [diagrams, setDiagrams] = useState<DiagramItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [shared, setShared] = useState<SharedWithItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Explorer | livediagram';
  }, []);

  // Fetch all the lists in parallel once we know we have an
  // authenticated owner id. Re-runs if the user signs in mid-page
  // (rare but possible: /live/explorer rendered the unsigned CTA,
  // user clicks Sign in, lands back here with isSignedIn=true).
  const refresh = useCallback(async (ownerId: string) => {
    setLoading(true);
    const [list, foldersList, sharedList] = await Promise.all([
      apiListDiagrams(ownerId).catch(() => null),
      apiListFolders(ownerId).catch(() => null),
      apiListSharedWith(ownerId).catch(() => null),
    ]);
    setDiagrams(list ?? []);
    setFolders(foldersList ?? []);
    setShared(sharedList ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoaded) return;
    if (!isSignedIn || !clerkUserId) {
      setLoading(false);
      return;
    }
    void refresh(clerkUserId);
  }, [authLoaded, isSignedIn, clerkUserId, refresh]);

  const dismissShared = (diagramId: string) => {
    if (!clerkUserId) return;
    setShared((prev) => prev.filter((s) => s.id !== diagramId));
    void apiDismissSharedWith(clerkUserId, diagramId).catch(() => {});
  };

  if (!clerkEnabled) {
    return (
      <FullPageNotice
        title="Explorer needs auth"
        body="This deployment was built without Clerk, so there's no signed-in workspace to show here. The floating Explorer on the editor still works for per-browser guest sessions."
        cta={{ href: '/live/', label: 'Back to editor' }}
      />
    );
  }
  if (!authLoaded) {
    return null; // suppress flicker before Clerk reports state
  }
  if (!isSignedIn) {
    return (
      <FullPageNotice
        title="Sign in to see your Explorer"
        body="Your owned diagrams, folders, and the diagrams others have shared with you all live here once you sign in."
        cta={{ href: '/live/sign-in/', label: 'Sign in' }}
      />
    );
  }

  // Signed-in render — three sections in a tall scrollable column.
  // Kept deliberately simple vs the floating panel's nested
  // folder tree; the standalone page's job is to surface every
  // file in a glanceable layout, not duplicate the panel's mini-
  // organiser.
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="relative z-50 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <Brand href="/" size="md" />
          <span className="text-sm font-medium text-slate-500">Explorer</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
          >
            New diagram
          </Link>
          <AuthControls />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">
            Hi {clerkDisplayName ?? 'there'} —
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Everything you own and everything that&apos;s been shared with you.
          </p>
        </div>

        <Section title="Your diagrams" count={diagrams.length}>
          {loading ? (
            <SkeletonGrid />
          ) : diagrams.length === 0 ? (
            <EmptyState message="No diagrams yet — start one from the editor." />
          ) : (
            <Grid>
              {diagrams
                .slice()
                .sort((a, b) => b.savedAt - a.savedAt)
                .map((d) => (
                  <DiagramCard
                    key={d.id}
                    href={`/diagram/${d.id}`}
                    title={d.name}
                    savedAt={d.savedAt}
                  />
                ))}
            </Grid>
          )}
        </Section>

        {folders.length > 0 ? (
          <Section title="Folders" count={folders.length}>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {folders
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <FolderGlyph />
                    <span className="truncate">{f.name}</span>
                  </li>
                ))}
            </ul>
          </Section>
        ) : null}

        {shared.length > 0 ? (
          <Section title="Shared with you" count={shared.length}>
            <Grid>
              {shared.map((s) => (
                <SharedCard
                  key={s.id}
                  // Shared diagrams need the `?s=<code>` query so
                  // the editor's hydration can resolve through the
                  // share-code path instead of the owner-only
                  // `/api/diagrams/:id` route. Without it the link
                  // 404s for the non-owner viewing the Shared list.
                  href={`/diagram/${s.id}?s=${encodeURIComponent(s.shareCode)}`}
                  title={s.name}
                  role={s.role}
                  savedAt={s.savedAt}
                  onDismiss={() => dismissShared(s.id)}
                />
              ))}
            </Grid>
          </Section>
        ) : null}
      </main>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
        <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-medium text-slate-600">
          {count}
        </span>
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}

function DiagramCard({ href, title, savedAt }: { href: string; title: string; savedAt: number }) {
  useRelativeTimeTick();
  return (
    <li>
      <Link
        href={href}
        className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-brand-300 hover:bg-brand-50/40"
      >
        <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Updated {formatRelativeTime(Date.now() - savedAt)}
        </p>
      </Link>
    </li>
  );
}

function SharedCard({
  href,
  title,
  role,
  savedAt,
  onDismiss,
}: {
  href: string;
  title: string;
  role: 'edit' | 'view';
  savedAt: number;
  onDismiss: () => void;
}) {
  useRelativeTimeTick();
  return (
    <li className="relative">
      <Link
        href={href}
        className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-brand-300 hover:bg-brand-50/40"
      >
        <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {role === 'edit' ? 'Edit · ' : 'View · '}
          Updated {formatRelativeTime(Date.now() - savedAt)}
        </p>
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 opacity-0 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus:opacity-100 group-hover:opacity-100"
      >
        ×
      </button>
    </li>
  );
}

function SkeletonGrid() {
  return (
    <Grid>
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
        />
      ))}
    </Grid>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
      {message}
    </p>
  );
}

function FullPageNotice({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <Brand href="/" size="md" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <Link
          href={cta.href}
          className="mt-5 inline-flex items-center justify-center rounded-md bg-brand-500 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
        >
          {cta.label}
        </Link>
      </div>
    </div>
  );
}

function FolderGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
      aria-hidden
    >
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4a1 1 0 0 1 .77.37l1 1.24A1 1 0 0 0 8.45 5h4.05A1.5 1.5 0 0 1 14 6.5v5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7z" />
    </svg>
  );
}
