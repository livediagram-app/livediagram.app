// What every part of the plan shares: the snapshot, the owner map, the ledger's view, the time the plan stands at,
// the writers for each database and the report it fills.
import type { DatabaseSync } from 'node:sqlite';
import type { MigrationApp } from '@liveworkspace/migration';
import type { OwnerMap } from '../owner-map.ts';
import type { LedgerView, SqlWriter } from '../sql.ts';
import type { Report } from './report.ts';

// Each database's tables in the order their rows may point at each other (sql.ts SqlWriter).
export const TABLE_ORDER = {
  accounts: [
    '"user"',
    'team',
    'team_member',
    'api_token',
    'settings',
    'email_lifecycle',
    'account_app',
    'profile',
    'legacy_guest',
  ],
  index: [
    'folders',
    'items',
    'favourites',
    'opens',
    'use_days',
    'share_links',
    'share_passwords',
    'shared_with',
    'placement_defaults',
    'timeline_events',
    'timeline_event_scopes',
  ],
  media: ['images', 'refs'],
  community: ['posts', 'post_tags', 'likes', 'copies', 'reports'],
} as const;

export const KIND_OF: Record<MigrationApp, 'canvas' | 'plan' | 'document' | 'design'> = {
  livediagram: 'canvas',
  liveplanner: 'plan',
  livedocuments: 'document',
  livedesign: 'design',
};

/** Where an old document's id landed, and what the later passes (Timeline, Community) need of it. */
export type KeptPart = {
  app: MigrationApp;
  scope: string;
  title: string;
  owner: string;
  trashed: boolean;
  closed: boolean;
};

export type PlanContext = {
  snapshot: DatabaseSync;
  owners: OwnerMap;
  ledger: LedgerView;
  /** The time the plan stands at: the snapshot's, so the same snapshot plans the same bundle. */
  now: number;
  bundleDir: string;
  sql: { accounts: SqlWriter; index: SqlWriter; media: SqlWriter; community: SqlWriter };
  report: Report;
  /** Old document id → the part that kept it (filled by the document pass). */
  kept: Map<string, KeptPart>;
  /** The share code each part answers to, upper-cased, by old code (filled by the document pass). */
  linkTargets: Map<string, { app: MigrationApp; id: string; code: string }>;
  /** When each guest was first seen, for its legacy_guest row. */
  guestFirstSeen: Map<string, number>;
};

export const scopeOf = (owner: string, teamId: string | null): string =>
  teamId ? `t:${teamId}` : `p:${owner}`;

export const DAY_MS = 86_400_000;
