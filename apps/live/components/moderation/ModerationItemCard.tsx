'use client';

import { useState } from 'react';
import {
  COMMUNITY_REPORT_REASONS,
  communityCategoryLabel,
  communityImagePath,
  type CommunityModerationItem,
  type CommunityPostState,
} from '@livediagram/api-schema';
import { Button, buttonClassName } from '@livediagram/ui';
import { CommunityAuthorDisc } from '@/components/primitives/CommunityAuthorDisc';
import { API_BASE } from '@/lib/api-client';
import { communityErrorMessage } from '@/lib/community-errors';
import { communityBoardPath, communityPostPath } from '@/lib/community-links';
import { track } from '@/lib/telemetry';

const REASON_LABELS = new Map<string, string>(COMMUNITY_REPORT_REASONS.map((r) => [r.id, r.label]));

const HIDDEN_BY_LABEL = {
  reports: 'Hidden by reports',
  operator: 'Hidden by an operator',
} as const;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// One reported or hidden post on the Moderation page (docs/specs/025-community/community.md "Reports
// and moderation"): the card image, title, author, state, every report, Open Document, and Hide or
// Restore.
export function ModerationItemCard({
  item,
  onModerate,
}: {
  item: CommunityModerationItem;
  onModerate: (postId: string, state: CommunityPostState) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hidden = item.state === 'hidden';

  const act = async (state: CommunityPostState) => {
    setBusy(true);
    setError(null);
    try {
      await onModerate(item.id, state);
      track('Community', 'Changed', state === 'hidden' ? 'Hidden' : 'Listed');
    } catch (err) {
      setError(communityErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row dark:border-slate-700 dark:bg-slate-900">
      <img
        src={`${API_BASE}${communityImagePath(item.shareCode)}`}
        alt={item.title}
        loading="lazy"
        className="aspect-[4/3] w-full shrink-0 rounded-lg border border-slate-100 bg-slate-50 object-contain sm:w-48 dark:border-slate-800 dark:bg-slate-950"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <a
              href={communityPostPath(item.id)}
              className="block truncate text-base font-semibold text-slate-900 hover:underline dark:text-slate-50"
            >
              {item.title}
            </a>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <CommunityAuthorDisc author={item.author} size={16} />
              {item.author.name} · {communityCategoryLabel(item.category)} · Published{' '}
              {formatDate(item.publishedAt)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              hidden
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200'
            }`}
          >
            {hidden ? HIDDEN_BY_LABEL[item.hiddenBy ?? 'operator'] : 'Listed'}
          </span>
        </div>

        {item.reports.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {item.reports.map((report, index) => (
              <li
                key={`${report.createdAt}-${index}`}
                className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {REASON_LABELS.get(report.reason) ?? report.reason}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {' '}
                  · {formatDate(report.createdAt)}
                </span>
                {report.note ? (
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300">{report.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No reports.</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <a
            href={communityBoardPath(item.shareCode)}
            target="_blank"
            rel="noopener"
            className={buttonClassName({ variant: 'secondary', size: 'xs' })}
          >
            Open Document
          </a>
          {hidden ? (
            <Button size="xs" onClick={() => act('listed')} disabled={busy}>
              {busy ? 'Restoring' : 'Restore'}
            </Button>
          ) : (
            <Button variant="danger" size="xs" onClick={() => act('hidden')} disabled={busy}>
              {busy ? 'Hiding' : 'Hide'}
            </Button>
          )}
          {error ? (
            <span role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {error}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
