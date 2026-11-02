'use client';

import { useEffect, useState } from 'react';
import { LIST_LIMIT_MAX, type Item } from '@liveworkspace/index-client';
import { teamsOfToken } from '@liveworkspace/index-client/browser';
import { currentBearer } from '@/lib/api/core';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useAfterLegacyClaim } from '@/hooks/persistence/useAfterLegacyClaim';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';
import { Glyph, TeamIcon } from '@livehuddle/ui';

// teamName: the team whose library holds it, for its team mark; null for your own.
type RecentItem = { id: string; name: string; savedAt: number | null; teamName: string | null };

// A small "jump back in" card that pops out to the RIGHT of the new-document
// wizard (docs/specs/007-editor/new-document-route.md), listing the 5 most recently-saved canvases the person
// owns or that sit in a team they have joined, as the index lists
// them (one page of livehuddle's items, newest first). Deliberately separate from the create flow: it's a side affordance
// for returning users, hidden entirely for someone with no documents yet
// (and on narrow viewports where the wizard already fills the width). Each
// row opens that document directly.
export function RecentDocumentsCard({ ownerId }: { ownerId: string | null }) {
  const [recent, setRecent] = useState<RecentItem[] | null>(null);
  const now = useRelativeNow();

  // Bumped when an old livehuddle.app guest's work was claimed, to re-read the list
  // (docs/specs/014-identity/auth-and-guest-access.md).
  const [claimVersion, setClaimVersion] = useState(0);
  useAfterLegacyClaim(() => setClaimVersion((v) => v + 1), !!ownerId);

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    void Promise.all([
      indexClient.listItems({ app: 'livehuddle', limit: LIST_LIMIT_MAX }),
      currentBearer().catch(() => null),
    ])
      .then(([page, token]) => {
        if (cancelled) return;
        const teamNames = new Map(teamsOfToken(token).map((t) => [t.id, t.name]));
        // Their own and their teams' live canvases; one reached only through a link is not theirs to jump back to.
        const live = page.items.filter((i) => i.trashedAt === null && i.sharedVia === null);
        const item = (i: Item): RecentItem => ({
          id: i.id,
          name: i.title,
          savedAt: i.updatedAt,
          teamName: i.teamId ? (teamNames.get(i.teamId) ?? 'Team') : null,
        });
        const top = live
          .filter((i) => !i.hiddenFromRecent)
          .map(item)
          .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
          .slice(0, 5);
        setRecent(top);
      })
      .catch(() => {
        // Best-effort: a returning user just doesn't get the shortcut.
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, claimVersion]);

  if (!recent || recent.length === 0) return null;

  return (
    // Rendered inside the page's right rail (see /new page.tsx), which owns
    // the positioning; this is just the card. A gentle hover lift gives it
    // life without tilting the text (a sub-pixel rotation made the resting
    // card render blurry).
    <div className="pointer-events-auto w-64 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-black/5 transition duration-micro hover:-translate-y-0.5 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40">
      <div className="flex items-center gap-2 rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-brand-50 to-transparent px-4 py-3 dark:border-slate-800 dark:from-brand-500/10">
        <ClockIcon />
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            Jump Back In
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Your recent canvases
          </span>
        </div>
      </div>
      <ul className="flex flex-col p-1.5">
        {recent.map((d) => (
          <li key={d.id}>
            <a
              href={`/document/${d.id}`}
              className="group flex items-center gap-2 rounded-lg px-2.5 py-2 transition hover:bg-brand-50 dark:hover:bg-brand-500/10"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-1 text-xs font-medium text-slate-700 group-hover:text-brand-700 dark:text-slate-200 dark:group-hover:text-brand-200">
                  {d.teamName != null ? (
                    <span className="shrink-0 text-slate-400 group-hover:text-brand-700">
                      <TeamIcon size={12} />
                      <span className="sr-only">{`${d.teamName} team: `}</span>
                    </span>
                  ) : null}
                  <span className="truncate">{d.name || 'Untitled canvas'}</span>
                </span>
                {d.savedAt != null ? (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {relativeSince(d.savedAt, now)}
                  </span>
                ) : null}
              </span>
              <ChevronRight />
            </a>
          </li>
        ))}
      </ul>
      {/* Footer: the card caps at 5 rows, so returning users with more
            history get a way into the full library. Points at the
            Explorer's front door rather than a named section, so the
            landing view stays decided in one place (docs/specs/013-workspace/timeline.md §8.1). */}
      <a
        href="/explorer"
        className="group flex items-center justify-center gap-1.5 rounded-b-2xl border-t border-slate-100 px-4 py-2.5 text-[11px] font-medium text-slate-500 transition hover:bg-brand-50 hover:text-brand-700 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-200"
      >
        Open Explorer
        <ChevronRight />
      </a>
    </div>
  );
}

function ClockIcon() {
  return (
    <Glyph size={16} units={16} className="shrink-0 text-brand-700 dark:text-brand-400">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 1.5" />
    </Glyph>
  );
}

function ChevronRight() {
  return (
    <Glyph
      size={12}
      units={12}
      className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-700 dark:text-slate-600"
    >
      <path d="M4.5 2.5L8 6l-3.5 3.5" />
    </Glyph>
  );
}
