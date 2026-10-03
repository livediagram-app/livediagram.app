// The Trash view's grouping (docs/specs/013-workspace/trash.md, "The Trash
// view"): your personal Trash, one group per joined team (by name), then this
// browser's local Trash. Each group is one Empty Trash scope. Pure.

import {
  EMPTY_DOCUMENT_STALE_DAYS,
  trashDaysLeft,
  type TrashedDocument,
} from '@livediagram/api-schema';
import type { TrashListing } from './api/trash';

export type TrashScope =
  { kind: 'personal' } | { kind: 'team'; teamId: string } | { kind: 'local' };

export type TrashGroup = {
  key: string;
  title: string;
  scope: TrashScope;
  // The Trash telemetry `type` for actions in this group.
  telemetryType: 'Personal' | 'Team' | 'Local';
  rows: TrashedDocument[];
};

export function trashGroups(listing: TrashListing): TrashGroup[] {
  const cloud = listing.cloud ?? [];
  const groups: TrashGroup[] = [];
  const personal = cloud.filter((r) => r.teamId === null);
  if (personal.length > 0) {
    groups.push({
      key: 'personal',
      title: 'Your documents',
      scope: { kind: 'personal' },
      telemetryType: 'Personal',
      rows: personal,
    });
  }
  const teams = new Map<string, TrashedDocument[]>();
  for (const r of cloud) {
    if (r.teamId === null) continue;
    teams.set(r.teamId, [...(teams.get(r.teamId) ?? []), r]);
  }
  const teamGroups = [...teams.entries()].map(([teamId, rows]) => ({
    key: `team:${teamId}`,
    title: rows[0]?.teamName || 'A team',
    scope: { kind: 'team', teamId } as const,
    telemetryType: 'Team' as const,
    rows,
  }));
  teamGroups.sort((a, b) => a.title.localeCompare(b.title));
  groups.push(...teamGroups);
  if (listing.local.length > 0) {
    groups.push({
      key: 'local',
      title: 'This browser only',
      scope: { kind: 'local' },
      telemetryType: 'Local',
      rows: listing.local,
    });
  }
  return groups;
}

// A row's lead: when it went in, and, for one the empty clean-up moved, why
// (docs/specs/013-workspace/empty-document-cleanup.md "In the Trash").
export function trashedOnLabel(row: Pick<TrashedDocument, 'trashedAt' | 'reason'>): string {
  const on = new Date(row.trashedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
  return row.reason === 'empty' ? `Moved here ${on} because it was empty` : `Deleted ${on}`;
}

// The deleted card's lead for someone who may restore it, with the days left.
export function trashedCardLead(row: Pick<TrashedDocument, 'trashedAt' | 'reason'>, now: number) {
  const where =
    row.reason === 'empty'
      ? `It was empty for ${EMPTY_DOCUMENT_STALE_DAYS} days, so it moved to the Trash`
      : 'It is in the Trash';
  return `${where} (${daysLeftLabel(row.trashedAt, now).toLowerCase()}).`;
}

export function daysLeftLabel(trashedAt: number, now: number): string {
  const days = trashDaysLeft(trashedAt, now);
  if (days === 0) return 'Removed at the next clean-up';
  return days === 1 ? '1 day left' : `${days} days left`;
}
