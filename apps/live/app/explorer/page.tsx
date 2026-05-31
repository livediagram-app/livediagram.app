'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Brand } from '@livediagram/ui';
import { AuthControls } from '@/components/AuthControls';
import { useClerkApiBootstrap } from '@/hooks/useClerkApiBootstrap';
import {
  apiDeleteDiagram,
  apiDismissSharedWith,
  apiListDiagrams,
  apiListSharedWith,
  apiSaveDiagramMeta,
  apiSetDiagramFolder,
  type SharedWithItem,
} from '@/lib/api-client';
import { clerkEnabled } from '@/lib/clerk-config';
import { useFolders } from '@/hooks/useFolders';
import { duplicateDiagram as duplicate } from '@/lib/duplicate-diagram';
import { formatRelativeTime, useRelativeTimeTick } from '@/lib/relative-time';
import { getTheme, type ThemeId } from '@/lib/themes';
import { MenuItem, PortalMenu } from '@/components/PortalMenu';

type DiagramItem = { id: string; name: string; folderId: string | null; savedAt: number };

// "Recent" cap on the top-of-page glance. Big enough to cover a
// typical "what was I just working on" recall, small enough that
// the section isn't a wall of cards before you can scroll to the
// folder buckets below.
const RECENT_LIMIT = 6;

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
  const {
    folders,
    createFolder: hookCreateFolder,
    renameFolder,
    deleteFolder,
    refresh: refreshFolders,
  } = useFolders(clerkUserId ?? null, { autoLoad: false });
  const [shared, setShared] = useState<SharedWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Folder id mid-rename so the row swaps to an input until the
  // user commits or escapes. `null` means no folder is being
  // renamed right now.
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  // Mirror of the floating Explorer's per-card state: which diagram
  // is mid-rename (so the title swaps to an input) and which is
  // showing the move-to-folder picker (anchored on a button via
  // moveAnchorRef so the portal can position itself).
  const [renamingDiagramId, setRenamingDiagramId] = useState<string | null>(null);
  const [moveTargetDiagramId, setMoveTargetDiagramId] = useState<string | null>(null);
  const moveAnchorRef = useRef<HTMLElement | null>(null);
  // Floating "+" FAB: opens a popover with "New diagram" + "New folder"
  // instead of jumping straight to /new.
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.title = 'Explorer | livediagram';
  }, []);

  const refresh = useCallback(
    async (ownerId: string) => {
      setLoading(true);
      const [list, sharedList] = await Promise.all([
        apiListDiagrams(ownerId).catch(() => null),
        apiListSharedWith(ownerId).catch(() => null),
        refreshFolders(),
      ]);
      setDiagrams(list ?? []);
      setShared(sharedList ?? []);
      setLoading(false);
    },
    [refreshFolders],
  );

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

  // Local wrapper around the hook's create — drops the user into
  // rename mode immediately after the optimistic stub lands so they
  // can type the real name. On failure rolls back the renaming
  // state too.
  const createFolder = async () => {
    const created = await hookCreateFolder({});
    if (created) setRenamingFolderId(created.id);
  };

  // Commit a rename via the hook, but also pull the row out of
  // "renaming" mode regardless of whether the new name is empty
  // (empty name → cancel; non-empty → persist).
  const commitRename = (id: string, name: string) => {
    setRenamingFolderId(null);
    renameFolder(id, name);
  };

  // Diagram-side mutations — mirror the floating Explorer's wiring
  // so the standalone page exposes the same actions per card. All
  // optimistic with silent rollback to keep the grid responsive.
  const renameDiagram = (id: string, name: string) => {
    if (!clerkUserId) return;
    const trimmed = name.trim();
    setRenamingDiagramId(null);
    if (!trimmed) return;
    setDiagrams((prev) => prev.map((d) => (d.id === id ? { ...d, name: trimmed } : d)));
    void apiSaveDiagramMeta(clerkUserId, { id, name: trimmed }).catch(() => {});
  };

  const deleteDiagram = (id: string) => {
    if (!clerkUserId) return;
    setDiagrams((prev) => prev.filter((d) => d.id !== id));
    void apiDeleteDiagram(clerkUserId, id).catch(() => {});
  };

  const moveDiagramToFolder = (id: string, folderId: string | null) => {
    if (!clerkUserId) return;
    setDiagrams((prev) => prev.map((d) => (d.id === id ? { ...d, folderId } : d)));
    void apiSetDiagramFolder(clerkUserId, id, folderId).catch(() => {});
  };

  const duplicateDiagram = async (id: string) => {
    if (!clerkUserId) return;
    await duplicate(clerkUserId, id);
    // Re-fetch the owned list so the new diagram lands in the grid
    // with a real savedAt (rather than a guessed local stub).
    const list = await apiListDiagrams(clerkUserId).catch(() => null);
    if (list) setDiagrams(list);
  };

  const openMovePicker = (id: string, anchor: HTMLElement | null) => {
    moveAnchorRef.current = anchor;
    setMoveTargetDiagramId(id);
  };

  // Folder picker rows — every folder is a flat row with its name.
  // No depth indicator; this surface is for "which folder?" not
  // "where in the tree?".
  const folderPickerRows = folders.slice().sort((a, b) => a.name.localeCompare(b.name));

  // Derived buckets for the per-folder sections below the Recent
  // grid. Sorted newest-first within each bucket so the cards
  // match the Recent ordering convention.
  const sortedByRecent = diagrams.slice().sort((a, b) => b.savedAt - a.savedAt);
  const recentDiagrams = sortedByRecent.slice(0, RECENT_LIMIT);
  const unsortedDiagrams = sortedByRecent.filter((d) => d.folderId === null);
  const diagramsByFolder = new Map<string, DiagramItem[]>();
  for (const d of sortedByRecent) {
    if (d.folderId === null) continue;
    const bucket = diagramsByFolder.get(d.folderId) ?? [];
    bucket.push(d);
    diagramsByFolder.set(d.folderId, bucket);
  }

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
    return null;
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

  return (
    <div className="relative flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Brand href="/" size="md" />
          <span className="text-sm font-medium text-slate-500">Explorer</span>
        </div>
        <AuthControls />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-32 pt-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Hi {clerkDisplayName ?? 'there'},
          </h1>
          <p className="mt-1 text-sm text-slate-600">Here is everything you own...</p>
        </div>

        {/* Recent — flat-grid top-of-page surface. Capped so the
            "what was I just working on" glance stays small; the
            full per-folder buckets below are the comprehensive
            view. */}
        <Section title="Recent" count={Math.min(diagrams.length, RECENT_LIMIT)}>
          {loading ? (
            <SkeletonGrid />
          ) : diagrams.length === 0 ? (
            <EmptyState message="No diagrams yet." cta={{ href: '/new', label: 'Start one' }} />
          ) : (
            <Grid>
              {recentDiagrams.map((d) => (
                <DiagramCard
                  key={d.id}
                  id={d.id}
                  href={`/diagram/${d.id}`}
                  title={d.name}
                  savedAt={d.savedAt}
                  renaming={renamingDiagramId === d.id}
                  onStartRename={() => setRenamingDiagramId(d.id)}
                  onCommitRename={(name) => renameDiagram(d.id, name)}
                  onCancelRename={() => setRenamingDiagramId(null)}
                  onDuplicate={() => void duplicateDiagram(d.id)}
                  onDelete={() => deleteDiagram(d.id)}
                  onMoveRequest={(anchor) => openMovePicker(d.id, anchor)}
                />
              ))}
            </Grid>
          )}
        </Section>

        {/* Thin rule below Recent so the change in scrolling cadence
            (one tight grid → a column of folder sections) reads as
            a deliberate transition rather than two sections accidentally
            butting against each other. */}
        {!loading && diagrams.length > 0 ? <hr className="mb-8 border-slate-200" /> : null}

        {/* Per-folder buckets. Unsorted first (only when it actually
            has at least one diagram — empty Unsorted is noise on a
            fully-bucketed account), then user folders alphabetically.
            Each section renders the diagrams in that bucket; user
            folders include rename + delete on the section title.
            New-folder action lives at the bottom of the group so it
            doesn't crowd the header. */}
        {!loading && unsortedDiagrams.length > 0 ? (
          <FolderBucket
            title="Unsorted"
            count={unsortedDiagrams.length}
            diagrams={unsortedDiagrams}
            renamingDiagramId={renamingDiagramId}
            onStartRenameDiagram={(id) => setRenamingDiagramId(id)}
            onCommitRenameDiagram={renameDiagram}
            onCancelRenameDiagram={() => setRenamingDiagramId(null)}
            onDuplicateDiagram={(id) => void duplicateDiagram(id)}
            onDeleteDiagram={deleteDiagram}
            onMoveDiagramRequest={openMovePicker}
          />
        ) : null}
        {!loading && folders.length > 0
          ? folders
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((f) => (
                <FolderBucket
                  key={f.id}
                  title={f.name}
                  folderId={f.id}
                  count={(diagramsByFolder.get(f.id) ?? []).length}
                  diagrams={diagramsByFolder.get(f.id) ?? []}
                  renamingTitle={renamingFolderId === f.id}
                  onStartRenameTitle={() => setRenamingFolderId(f.id)}
                  onCommitRenameTitle={(name) => commitRename(f.id, name)}
                  onCancelRenameTitle={() => setRenamingFolderId(null)}
                  onDeleteFolder={() => deleteFolder(f.id)}
                  renamingDiagramId={renamingDiagramId}
                  onStartRenameDiagram={(id) => setRenamingDiagramId(id)}
                  onCommitRenameDiagram={renameDiagram}
                  onCancelRenameDiagram={() => setRenamingDiagramId(null)}
                  onDuplicateDiagram={(id) => void duplicateDiagram(id)}
                  onDeleteDiagram={deleteDiagram}
                  onMoveDiagramRequest={openMovePicker}
                />
              ))
          : null}
        {!loading ? (
          <div className="mb-10">
            <button
              type="button"
              onClick={() => void createFolder()}
              className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-transparent px-3 py-1.5 text-[11px] font-medium text-slate-500 transition hover:border-brand-300 hover:text-brand-700"
            >
              <PlusIcon />
              New folder
            </button>
          </div>
        ) : null}

        {shared.length > 0 ? (
          <Section title="Shared with you" count={shared.length}>
            <Grid>
              {shared.map((s) => (
                <SharedCard
                  key={s.id}
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
      {/* Floating "+" FAB. Lives at z-40 so it stays above the sticky
          header's z-30 backdrop. Opens a popover with "New diagram"
          and "New folder" so the page has a single create surface
          rather than two separate buttons. */}
      <button
        ref={fabRef}
        type="button"
        aria-label="Create"
        aria-expanded={fabMenuOpen}
        onClick={() => setFabMenuOpen((o) => !o)}
        className="fixed bottom-8 right-8 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-500/40"
      >
        <PlusIcon size={22} />
      </button>
      {fabMenuOpen ? (
        <PortalMenu anchor={fabRef.current} placement="above" onClose={() => setFabMenuOpen(false)}>
          <MenuItem
            icon={<PlusIcon />}
            label="New diagram"
            onClick={() => {
              setFabMenuOpen(false);
              window.location.assign('/live/new');
            }}
          />
          <MenuItem
            icon={<PlusIcon />}
            label="New folder"
            onClick={() => {
              setFabMenuOpen(false);
              void createFolder();
            }}
          />
        </PortalMenu>
      ) : null}
      {moveTargetDiagramId ? (
        // Move-to-folder picker rendered at the page level so the
        // portal doesn't nest inside the card's per-row PortalMenu.
        // Anchored on whichever card opened the picker via the
        // moveAnchorRef set in openMovePicker.
        <PortalMenu
          anchor={moveAnchorRef.current}
          placement="below"
          onClose={() => setMoveTargetDiagramId(null)}
        >
          <MenuItem
            icon={<MenuFolderIcon />}
            label="Unsorted"
            onClick={() => {
              moveDiagramToFolder(moveTargetDiagramId, null);
              setMoveTargetDiagramId(null);
            }}
          />
          {folderPickerRows.map((f) => (
            <MenuItem
              key={f.id}
              icon={<MenuFolderIcon />}
              label={f.name}
              onClick={() => {
                moveDiagramToFolder(moveTargetDiagramId, f.id);
                setMoveTargetDiagramId(null);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </div>
  );
}

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
          <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-medium text-slate-600">
            {count}
          </span>
        </h2>
        {accent}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}

// One bucket = one row of cards under a section heading. Unsorted
// passes no folder-side props (no rename / delete). User folders
// pass the full set so the title is inline-editable and an
// ellipsis menu surfaces Delete.
function FolderBucket({
  title,
  count,
  folderId,
  diagrams,
  renamingTitle,
  onStartRenameTitle,
  onCommitRenameTitle,
  onCancelRenameTitle,
  onDeleteFolder,
  renamingDiagramId,
  onStartRenameDiagram,
  onCommitRenameDiagram,
  onCancelRenameDiagram,
  onDuplicateDiagram,
  onDeleteDiagram,
  onMoveDiagramRequest,
}: {
  title: string;
  count: number;
  folderId?: string;
  diagrams: DiagramItem[];
  renamingTitle?: boolean;
  onStartRenameTitle?: () => void;
  onCommitRenameTitle?: (name: string) => void;
  onCancelRenameTitle?: () => void;
  onDeleteFolder?: () => void;
  renamingDiagramId: string | null;
  onStartRenameDiagram: (id: string) => void;
  onCommitRenameDiagram: (id: string, name: string) => void;
  onCancelRenameDiagram: () => void;
  onDuplicateDiagram: (id: string) => void;
  onDeleteDiagram: (id: string) => void;
  onMoveDiagramRequest: (id: string, anchor: HTMLElement | null) => void;
}) {
  const editable = onCommitRenameTitle !== undefined;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(title);
  useEffect(() => {
    if (renamingTitle) {
      setDraft(title);
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [renamingTitle, title]);

  const heading = renamingTitle ? (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommitRenameTitle?.(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommitRenameTitle?.(draft);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancelRenameTitle?.();
        }
      }}
      className="rounded border border-brand-300 bg-white px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-700 outline-none focus:border-brand-500"
    />
  ) : editable ? (
    <button
      type="button"
      onClick={onStartRenameTitle}
      className="text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:text-brand-700"
    >
      {title}
    </button>
  ) : (
    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
  );

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2">
          {heading}
          <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-medium text-slate-600">
            {count}
          </span>
        </h2>
        {editable && !renamingTitle ? (
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={`Menu for folder ${title}`}
            aria-expanded={menuOpen}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <circle cx="3" cy="7" r="1.25" fill="currentColor" />
              <circle cx="7" cy="7" r="1.25" fill="currentColor" />
              <circle cx="11" cy="7" r="1.25" fill="currentColor" />
            </svg>
          </button>
        ) : null}
      </div>
      {diagrams.length === 0 ? (
        <EmptyState
          message={
            folderId !== undefined
              ? 'Empty folder. Move diagrams here from the Recent grid above.'
              : 'No unsorted diagrams.'
          }
        />
      ) : (
        <Grid>
          {diagrams.map((d) => (
            <DiagramCard
              key={d.id}
              id={d.id}
              href={`/diagram/${d.id}`}
              title={d.name}
              savedAt={d.savedAt}
              renaming={renamingDiagramId === d.id}
              onStartRename={() => onStartRenameDiagram(d.id)}
              onCommitRename={(name) => onCommitRenameDiagram(d.id, name)}
              onCancelRename={onCancelRenameDiagram}
              onDuplicate={() => onDuplicateDiagram(d.id)}
              onDelete={() => onDeleteDiagram(d.id)}
              onMoveRequest={(anchor) => onMoveDiagramRequest(d.id, anchor)}
            />
          ))}
        </Grid>
      )}
      {menuOpen && editable ? (
        <PortalMenu
          anchor={menuButtonRef.current}
          placement="below"
          onClose={() => setMenuOpen(false)}
        >
          <MenuItem
            icon={<MenuPencilIcon />}
            label="Rename"
            onClick={() => {
              onStartRenameTitle?.();
              setMenuOpen(false);
            }}
          />
          {onDeleteFolder ? (
            <MenuItem
              icon={<MenuTrashIcon />}
              label="Delete folder"
              danger
              onClick={() => {
                onDeleteFolder();
                setMenuOpen(false);
              }}
            />
          ) : null}
        </PortalMenu>
      ) : null}
    </section>
  );
}

// A larger, glanceable card: a thin themed accent bar across the
// top hints at "this is one of my diagrams" without needing a real
// thumbnail (we don't fetch tab snapshots client-side here). Title
// gets two lines of breathing room, the timestamp drops to a muted
// caption.
function DiagramCard({
  id,
  href,
  title,
  savedAt,
  renaming,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDuplicate,
  onDelete,
  onMoveRequest,
}: {
  id: string;
  href: string;
  title: string;
  savedAt: number;
  renaming: boolean;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveRequest: (anchor: HTMLElement | null) => void;
}) {
  useRelativeTimeTick();
  // Cheap deterministic accent per diagram — hash the id-ish title
  // into the theme palette so cards aren't all one colour. Keeps
  // /explorer feeling like a personal library without making a
  // network call for the active tab's theme.
  const accent = pickAccent(title);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(title);
  useEffect(() => {
    if (renaming) {
      setDraft(title);
      const t = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(t);
    }
  }, [renaming, title]);

  const titleNode = renaming ? (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onBlur={() => onCommitRename(draft)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommitRename(draft);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancelRename();
        }
      }}
      className="w-full rounded border border-brand-300 bg-white px-2 py-1 text-sm font-semibold text-slate-900 outline-none focus:border-brand-500"
    />
  ) : (
    <p className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-brand-700">
      {title}
    </p>
  );
  const cardBody = (
    <>
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <div className="p-4">
        {titleNode}
        <p className="mt-2 text-[11px] uppercase tracking-wider text-slate-400">
          Updated {formatRelativeTime(Date.now() - savedAt)}
        </p>
      </div>
    </>
  );
  return (
    <li className="group relative">
      {renaming ? (
        // Rendering the title-as-input requires us to bail out of
        // the wrapping <Link> for this row only — clicking inside an
        // <input> inside an <a> still propagates a navigation on
        // some browsers, which would commit a rename + open the
        // diagram simultaneously. Plain <div> keeps the input usable.
        <div className="block overflow-hidden rounded-xl border border-brand-300 bg-white shadow-sm">
          {cardBody}
        </div>
      ) : (
        <Link
          href={href}
          className="block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
        >
          {cardBody}
        </Link>
      )}
      {renaming ? null : (
        <button
          ref={menuButtonRef}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label={`Menu for ${title}`}
          aria-expanded={menuOpen}
          className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white/90 text-slate-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="3" cy="7" r="1.25" fill="currentColor" />
            <circle cx="7" cy="7" r="1.25" fill="currentColor" />
            <circle cx="11" cy="7" r="1.25" fill="currentColor" />
          </svg>
        </button>
      )}
      {menuOpen ? (
        <PortalMenu
          anchor={menuButtonRef.current}
          placement="below"
          onClose={() => setMenuOpen(false)}
        >
          <MenuItem
            icon={<MenuPencilIcon />}
            label="Rename"
            onClick={() => {
              onStartRename();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuDuplicateIcon />}
            label="Duplicate"
            onClick={() => {
              onDuplicate();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuFolderIcon />}
            label="Move to folder…"
            onClick={() => {
              onMoveRequest(menuButtonRef.current);
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<MenuTrashIcon />}
            label="Delete"
            danger
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
          />
        </PortalMenu>
      ) : null}
    </li>
  );
  // `id` is captured at the call site for keying — referenced here
  // only to satisfy unused-prop linters until the duplicate flow
  // ever needs it locally.
  void id;
}

// Menu glyphs colocated with DiagramCard so it stays self-contained.
function MenuPencilIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11z" />
    </svg>
  );
}

function MenuDuplicateIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M2 11V3.5A1.5 1.5 0 0 1 3.5 2H10" />
    </svg>
  );
}

function MenuFolderIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4a1 1 0 0 1 .77.37l1 1.24A1 1 0 0 0 8.45 5h4.05A1.5 1.5 0 0 1 14 6.5v5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7z" />
    </svg>
  );
}

function MenuTrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 4h10M6 4V2.5h4V4M4.5 4l.6 9.2A1 1 0 0 0 6.1 14h3.8a1 1 0 0 0 1-0.8l.6-9.2" />
    </svg>
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
    <li className="group relative">
      <Link
        href={href}
        className="block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
      >
        <div className="h-1.5 bg-emerald-400" />
        <div className="p-4">
          <p className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-brand-700">
            {title}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-400">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
              {role === 'edit' ? 'Edit' : 'View'}
            </span>
            <span>Updated {formatRelativeTime(Date.now() - savedAt)}</span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onDismiss();
        }}
        aria-label="Dismiss"
        className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white/90 text-slate-500 opacity-0 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus:opacity-100 group-hover:opacity-100"
      >
        <CloseIcon />
      </button>
    </li>
  );
}

// One folder row — collapsed to a small pill in the grid. Click the
// label to rename inline; the trailing × deletes (server promotes
// any contents to Unsorted). Renaming is uncommitted until Enter or
// blur; Escape reverts.
function SkeletonGrid() {
  return (
    <Grid>
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
        />
      ))}
    </Grid>
  );
}

function EmptyState({ message, cta }: { message: string; cta?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="text-sm text-slate-500">{message}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
        >
          <PlusIcon />
          {cta.label}
        </Link>
      ) : null}
    </div>
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

function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3.5 3.5l7 7M3.5 10.5l7-7" />
    </svg>
  );
}

// Deterministic accent picker — hashes the diagram name into the
// theme palette so each card gets a stable colour stripe without
// needing the active tab data. Same string → same colour across
// renders, which keeps the grid visually settled.
function pickAccent(seed: string): string {
  const themeIds: ThemeId[] = [
    'brand',
    'forest',
    'sunset',
    'lavender',
    'ocean',
    'crimson',
    'rose',
    'indigo',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const id = themeIds[hash % themeIds.length]!;
  const theme = getTheme(id);
  return theme.elementStroke ?? theme.patternColor ?? '#0ea5e9';
}
