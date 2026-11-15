// Version history (docs/specs/006-document/version-history.md; blueprint "Interfaces and contracts"): the bounds,
// kinds and wire shapes the api, the MCP and the editor share. A version is one tab's stored content at one revision.

import type { Tab } from '@livedocuments/document';
import { TRASH_RETENTION_DAYS } from './trash';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// The first write after a tab sat this long unchanged keeps it as it stood. Safe range 5 to 120 minutes.
export const VERSION_IDLE_MS = 30 * MINUTE_MS;
// An agent's changesets on a tab this close together are one burst, with one version before it (as the changeset
// toast coalesces a token's burst). Safe range 1 to 60 minutes.
export const VERSION_AGENT_BURST_MS = 10 * MINUTE_MS;
// Automatic (unnamed) versions kept per tab: the newest this many. Safe range 10 to 200.
export const VERSION_AUTO_MAX = 50;
// Automatic versions older than this go: matches changeset retention and the Trash. Safe range 7 to 90 days.
export const VERSION_AUTO_MAX_DAYS = TRASH_RETENTION_DAYS;
export const VERSION_AUTO_MAX_AGE_MS = VERSION_AUTO_MAX_DAYS * DAY_MS;
// Automatic versions past this many bytes, counting from the newest, go. Safe range 4 to 64 MiB.
export const VERSION_AUTO_MAX_BYTES = 16 * 1024 * 1024;
// Named versions a tab may keep; naming one more is refused. Safe range 5 to 100.
export const VERSION_NAMED_MAX = 25;

export const VERSION_KINDS = ['idle', 'agent', 'restore', 'manual'] as const;
export type VersionKind = (typeof VERSION_KINDS)[number];

// A version as the rail lists it: everything but its body.
export type VersionSummary = {
  id: string;
  tabId: string;
  // The tab revision it holds.
  rev: number;
  kind: VersionKind;
  // Named when not null.
  name: string | null;
  // Who it names: the namer, the restorer, the person whose agent wrote. Null for an idle version.
  author: { name: string; color: string } | null;
  // When its content was last written, epoch ms.
  savedAt: number;
  // When it was kept, epoch ms.
  createdAt: number;
  bytes: number;
  elementCount: number;
};

export type VersionListResponse = { versions: VersionSummary[] };
// One version with its body as it was, under the tab's id and the name the tab had then.
export type VersionReadResponse = { version: VersionSummary; tab: Tab };
export type VersionNameResponse = { version: VersionSummary };
// Null when the version's content was already the tab's: nothing was written.
export type VersionRestoreResponse = {
  restored: {
    tabId: string;
    rev: number;
    changesetId: string | null;
    undoVersionId: string;
  } | null;
};
export type VersionCopyResponse = { tab: { id: string; name: string; rev: number } };

// The summary a Make a Copy changeset carries.
export const COPY_SUMMARY = 'Copied a version';

// The summary a restore's changeset carries: what the toast and the changeset history show.
export function restoreSummary(name: string | null): string {
  if (!name) return 'Restored a version';
  const full = `Restored “${name}”`;
  return full.length <= 80 ? full : `${full.slice(0, 78)}…”`;
}
