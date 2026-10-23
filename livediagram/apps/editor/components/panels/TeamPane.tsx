'use client';

import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Button, CircleXIcon } from '@livediagram/ui';
import { apiGetTeam } from '@/lib/api-client';
import type { TeamDetailResponse } from '@/lib/api/teams';
import { manageTeamsUrl } from '@/lib/auth-config';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { TeamMemberRow } from './team-pane-parts';
import { TeamSharedDocuments } from '@/components/panels/TeamSharedDocuments';
import { TeamTimeline } from './ScopedTimeline';
import { useLatest } from '@/hooks/ui/useLatest';
import { LIST_CARD } from '@/components/primitives/surface-classes';
import { explorerSurfaceFlags, useExplorerSurface } from '@/app/explorer/explorer-surface';

// Right-pane team view for the Explorer (docs/specs/013-workspace/teams.md): one calm card — header
// (member count, and where to manage the team) and the member list with avatars and real names —
// then the team's shared documents and history. The team itself is run on liveworkspace.app
// (liveworkspace/docs/accounts.md "Teams"), the same team in every app, so inviting, roles, renaming,
// leaving and deleting happen there.

export function TeamPane({
  ownerId,
  teamId,
  accountUserId,
  accountDisplayName,
  onLeftTeam,
  onLoadResult,
  moveDests,
  onMoveDocumentTo,
  lens,
  onLibraryChange,
}: {
  ownerId: string;
  teamId: string;
  accountUserId: string | null;
  // The signed-in user's display name, so their own row reads as a
  // person ("Thomas") rather than a placeholder ("You").
  accountDisplayName: string | null;
  // The team isn't there for the caller (gone, or they left on liveworkspace.app) — the page bounces
  // selection off the dead team node.
  onLeftTeam: () => void;
  // Whether the team loaded (true) or 404'd (false). The pane header
  // uses this to drop the team title on a 404 — there's no team to name.
  onLoadResult?: (found: boolean) => void;
  // Full move destinations + cross-scope router for the shared-documents
  // move picker (docs/specs/013-workspace/team-shared-documents.md): passed straight through to TeamSharedDocuments
  // so a team document can be re-homed to My Work / another team.
  moveDests?: ComponentProps<typeof TeamSharedDocuments>['moveDests'];
  onMoveDocumentTo?: ComponentProps<typeof TeamSharedDocuments>['onMoveDocumentTo'];
  // The Explorer's lens (docs/specs/013-workspace/explorer-filters.md), passed straight through.
  lens?: ComponentProps<typeof TeamSharedDocuments>['lens'];
  // Passed straight through: a library this page changed, for the Explorer's own lists.
  onLibraryChange?: ComponentProps<typeof TeamSharedDocuments>['onLibraryChange'];
}) {
  const surface = useExplorerSurface();
  const [detail, setDetail] = useState<TeamDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Read at its newest when a load lands: callers pass it inline, and it must not make refresh (and
  // with it the load below) change identity on every caller render.
  const onLoadResultRef = useLatest(onLoadResult);

  // Loads the team; the outcome lands only while `isCurrent` holds, so a slow reply for the team the
  // pane has since left never overwrites the one it shows.
  const load = useCallback(
    (isCurrent: () => boolean = () => true): Promise<void> =>
      apiGetTeam(ownerId, teamId).then(
        (d) => {
          if (!isCurrent()) return;
          setDetail(d);
          setFailed(false);
          setLoading(false);
          onLoadResultRef.current?.(true);
        },
        () => {
          if (!isCurrent()) return;
          setFailed(true);
          setLoading(false);
          onLoadResultRef.current?.(false);
        },
      ),
    [ownerId, teamId, onLoadResultRef],
  );
  // A different team (or viewer) starts over from the skeleton, reset during render; the load itself
  // is the effect.
  const [loadedFor, setLoadedFor] = useState({ ownerId, teamId });
  if (loadedFor.ownerId !== ownerId || loadedFor.teamId !== teamId) {
    setLoadedFor({ ownerId, teamId });
    setDetail(null);
    setLoading(true);
    setFailed(false);
  }
  useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, [load]);

  if (loading) {
    return (
      <div className={LIST_CARD}>
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="h-8 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <span className="h-4 flex-1 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <span className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (failed || !detail) {
    // The API 404/403s a team you're not a member of (we don't leak
    // its existence). Surface a proper 404 card rather than a vague
    // "couldn't load" line, with a way back to the user's own work.
    return (
      <div className="flex items-center justify-center px-6 py-16">
        <div className="flex max-w-md animate-pop-in flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300">
            <CircleXIcon />
          </div>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-rose-600">
            404
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            Team not found
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            This team doesn&apos;t exist, or you&apos;re not a member of it. Ask an admin for an
            invite, or head back to your own documents.
          </p>
          <Button size="md" onClick={onLeftTeam} className="mt-6 shadow-sm">
            Back to your documents
          </Button>
        </div>
      </div>
    );
  }

  const { team, members, myRole } = detail;
  // A workspace frame reaches no team administration (WB62): the team's documents only.
  const administration = explorerSurfaceFlags(surface).administration;

  const joinedCount = members.filter((m) => m.status === 'joined').length;
  const headline = [
    `${joinedCount} ${joinedCount === 1 ? 'member' : 'members'}`,
    myRole === 'admin' ? 'You’re an admin' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-4">
      <div className={LIST_CARD}>
        {/* ---------- Header: context line + where the team is run ---------- */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">{headline}</p>
          {administration ? (
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={manageTeamsUrl}
                className="relative touch-target-y inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                Manage on liveworkspace.app
              </a>
              <HelpArticleLink article="teamRolesAndInvites" variant="icon" />
            </div>
          ) : null}
        </div>

        {/* ---------- Members ---------- */}
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {members.map((m) => (
            <TeamMemberRow
              key={m.id}
              m={m}
              accountUserId={accountUserId}
              accountDisplayName={accountDisplayName}
            />
          ))}
        </ul>
      </div>

      {/* ---------- Shared documents (docs/specs/013-workspace/team-shared-documents.md): the team's folder
          tree + documents, managed by every joined member. ---------- */}
      {/* key on teamId so switching teams remounts the library and
          resets its open-folder `spot` — otherwise a subfolder open in
          team A leaks into team B as a stale, empty folder view. */}
      <TeamSharedDocuments
        key={`library-${teamId}`}
        ownerId={ownerId}
        teamId={teamId}
        teamName={team.name}
        moveDests={moveDests}
        onMoveDocumentTo={onMoveDocumentTo}
        lens={lens}
        onLibraryChange={onLibraryChange}
      />

      {/* The team's own history (docs/specs/013-workspace/timeline.md §3.4). Distinct from each
          member's personal feed: the per-member scopes are written when
          an event happens, so somebody who joined in March has nothing
          from February — this scope carries the whole thing.

          Keyed on teamId for the same reason the library above is:
          switching teams is a query-string navigation on this route, so
          without it the feed stays mounted and carries team A's view
          settings into team B — the category chips, the Everyone/Other
          people filter, and the calendar month it was parked on. Its key
          differs from the library's: they are siblings, and React needs
          sibling keys to be unique. */}
      <TeamTimeline key={`timeline-${teamId}`} ownerId={ownerId} teamId={teamId} />
    </div>
  );
}
