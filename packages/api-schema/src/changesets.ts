// Agent changesets (docs/specs/024-agents/agent-changesets.md): the constants, headers, id
// pattern, error codes and wire types the api, the MCP, the CLI and the editor share
// (docs/specs/024-agents/blueprints/agent-changesets.md, CS35). The result lines, warnings and
// rejections of the edit-operations engine travel inside a changeset's answer, so their wire
// shapes live here too and the engine re-exports them.

import type { Element, ElementOp, Tab } from '@livediagram/document';
import { MAX_TAB_BYTES } from './tab-size';
import { TRASH_RETENTION_DAYS } from './trash';

// ---------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------

// A full tab rebuild of a large diagram fits; a runaway loop does not.
export const CHANGESET_MAX_OPERATIONS = 500;
// Under the room's 256 KiB frame cap with room for the op's metadata.
export const CHANGESET_RELAY_MAX_BYTES = 192 * 1024;
// How far back a save without `X-Changeset-Seen` (a bundle older than changesets) is merged.
export const CHANGESET_MERGE_WINDOW_MS = 10 * 60 * 1000;
// Matches the Trash: an agent's work can be undone as long as a delete can.
export const CHANGESET_RETENTION_DAYS = TRASH_RETENTION_DAYS;
export const CHANGESET_RETENTION_MS = CHANGESET_RETENTION_DAYS * 24 * 60 * 60 * 1000;
// The outline in the author's colour.
export const CHANGESET_REVEAL_MS = 2000;
// Changesets from one token within this share one toast.
export const CHANGESET_TOAST_COALESCE_MS = 10_000;
export const CHANGESET_SUMMARY_MAX = 80;
// One D1 row per part: `MAX_TAB_BYTES`, so every part row fits D1's 2,000,000 bytes (CS43).
export const CHANGESET_PART_MAX_BYTES = MAX_TAB_BYTES;
// Records a save's merge reads at once (CS18).
export const CHANGESET_MERGE_PAGE = 20;
export const CHANGESET_LIST_DEFAULT = 20;
export const CHANGESET_LIST_MAX = 100;
export const CHANGESET_ID_LENGTH = 10;
// The room calls the api awaits (CS20).
export const ROOM_SELECTIONS_TIMEOUT_MS = 1500;
export const ROOM_RELAY_TIMEOUT_MS = 2000;
// A `select` op names at most this many ids (CS38).
export const MAX_SELECTION_IDS = 500;
// A tab save repeats a lost compare-and-swap once (CS4).
export const TAB_SAVE_CAS_ATTEMPTS = 2;

// ---------------------------------------------------------------------
// Headers and ids
// ---------------------------------------------------------------------

// The highest changeset revision an editor has applied to the tab it saves.
export const CHANGESET_SEEN_HEADER = 'X-Changeset-Seen';
// Which surface sent a request: `mcp`, `cli` or `editor`; absent means a plain API caller (CS25).
export const CLIENT_HEADER = 'X-Livediagram-Client';
export const CLIENT_KINDS = ['mcp', 'cli', 'editor'] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];

// `cs_` and 10 lowercase Crockford base32 characters (CS7).
export const CHANGESET_ID_PATTERN = /^cs_[0-9abcdefghjkmnpqrstvwxyz]{10}$/;

export function isChangesetId(value: unknown): value is string {
  return typeof value === 'string' && CHANGESET_ID_PATTERN.test(value);
}

// `X-Changeset-Seen`: a decimal integer from 0 to MAX_SAFE_INTEGER, else null (CS19).
export function parseChangesetSeen(header: string | null): number | null {
  if (header === null || !/^\d{1,16}$/.test(header)) return null;
  const value = Number(header);
  return Number.isSafeInteger(value) ? value : null;
}

// The weak ETag a tab read carries (CS5).
export function tabEtag(rev: number): string {
  return `W/"${rev}"`;
}

// ---------------------------------------------------------------------
// Edit-operation results, warnings and rejections (the engine's answer)
// ---------------------------------------------------------------------

export const EDIT_REJECTION_CODES = [
  'parse_error',
  'unknown_operation',
  'target_not_found',
  'target_ambiguous',
  'unknown_field',
  'invalid_value',
  'id_taken',
  'arrow_exists',
  'not_connected',
  'frame_captures',
  'element_locked',
  'test_failed',
  'changeset_conflict',
  'elements_held',
  'invalid_result',
  'too_large',
] as const;
export type EditRejectionCode = (typeof EDIT_REJECTION_CODES)[number];

export const EDIT_WARNING_CODES = [
  'no_base',
  'shape_coerced',
  'value_coerced',
  'label_capped',
  'colour_overrides_theme',
  'arrows_freed',
] as const;
export type EditWarningCode = (typeof EDIT_WARNING_CODES)[number];

// A named refusal. `operation` is 1-based among the operations (comments and blank lines not
// counted); `op` the refused operation in its canonical line form; `line` / `column` for a parse
// error. `details` and `hint` are the indented lines the formatter prints under the header.
export type EditRejection = {
  code: EditRejectionCode;
  operation?: number;
  op?: string;
  line?: number;
  column?: number;
  details: string[];
  hint?: string;
};

export type EditWarning = { code: EditWarningCode; ref?: string; message: string };

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// One change on a `~` line. Positions use the key `at` with `[x, y]`, arrow ends `from` / `to`
// with a ref or `[x, y]` for a free end, fit to label `widened` / `taller` with the sizes.
export type FieldChange = { key: string; from?: JsonValue; to?: JsonValue };

export type ResultLine =
  | {
      mark: '+';
      ref: string;
      kind: string;
      label?: string;
      at?: [number, number];
      size?: [number, number];
      ends?: [string, string];
      styleOf?: string;
    }
  | { mark: '~'; ref: string; changes: FieldChange[] }
  | {
      mark: '-';
      ref: string;
      kind: string;
      label?: string;
      ends?: [string, string];
      reason?: 'pinned' | 'unwrapped';
      pinnedTo?: string;
    }
  | {
      mark: '»';
      refs: string[];
      delta?: [number, number];
      reason: 'make room' | 'carried' | 'laid out' | 'landed on a lane';
      // How `layout` laid them out; a direction only for the flow style.
      layout?: { style: 'flow' | 'tree' | 'mindmap'; direction?: 'down' | 'right' };
    }
  | { mark: 'container'; ref: string; joined: string[]; left: string[] }
  | { mark: '!'; warning: EditWarning };

// ---------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------

// The revision the agent read and the fingerprint of each element it targets, as read.
export type ChangesetBase = { rev: number; elements?: Record<string, string> };

// The whole-tab body: exactly one source; `layout` for elements, `theme` and `name` for a tab it
// creates (a `name` on an existing tab is ignored).
export type ChangesetReplaceBody = {
  graph?: unknown;
  mermaid?: string;
  template?: string;
  elements?: unknown[];
  layout?: 'auto' | 'preserve';
  theme?: string;
  name?: string;
};

// `operations` is the JSON form (an array) or the line form (a string), CS8; exactly one of it
// and `replace`.
export type ChangesetRequest = {
  operations?: unknown[] | string;
  replace?: ChangesetReplaceBody;
  base?: ChangesetBase;
  strict?: boolean;
  summary?: string;
};

// ---------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------

export type ChangesetCounts = { added: number; changed: number; removed: number };

export type ChangesetWritten = {
  id: string;
  tabId: string;
  rev: number;
  previousRev: number;
  rebasedOver: number;
};

export type ChangesetResponse = {
  dryRun: boolean;
  changeset: ChangesetWritten | null;
  results: ResultLine[];
  // The result lines and the footer as text: the same for a dry run and a write.
  text: string;
  warnings: string[];
  // The diagram lint's report; null while the lint is unavailable (docs/specs/024-agents/diagram-lint.md).
  lint: null;
};

export type ChangesetConflict = {
  id: string;
  reason: 'changed' | 'vanished' | 'resolves_differently';
  readFingerprint: string | null;
  now: Element | null;
};

export type HeldElement = { id: string; by: { name: string; color: string } };

export type ChangesetAuthor = { name: string; color: string };

export type ChangesetSummary = {
  id: string;
  tabId: string;
  rev: number;
  author: ChangesetAuthor;
  agent: boolean;
  // Only to the changeset's author (CS26).
  tokenId?: string;
  summary: string | null;
  counts: ChangesetCounts;
  revertOf: string | null;
  createdAt: number;
};

export type ChangesetDetail = { changeset: ChangesetSummary; results: ResultLine[]; text: string };

export type RevertKept = { id: string; reason: 'changed' | 'gone' | 'present' | 'order' };

export type RevertResponse = {
  changeset: ChangesetWritten | null;
  reverted: number;
  kept: RevertKept[];
  lint: null;
};

// The route's refusal codes beside the engine's.
export const CHANGESET_ERROR_CODES = [
  'invalid_body',
  'invalid_base',
  'strict_needs_base',
  'changeset_conflict',
  'elements_held',
  'tab_busy',
  'tab_id_taken',
  'stale_tab',
  'too_large',
  'use_changesets',
  'invalid_name',
] as const;
export type ChangesetErrorCode = (typeof CHANGESET_ERROR_CODES)[number];

// ---------------------------------------------------------------------
// The room op
// ---------------------------------------------------------------------

// One changeset, sequenced by the document's room in one log slot. `elementOps` is absent and
// `refetch` set when they exceed CHANGESET_RELAY_MAX_BYTES; `touched` then names every id. `tab`
// carries a created tab's non-element fields (CS23). `agentKey` is a one-way digest of the token
// id, present only for an agent's changeset (CS22). `prevRev` is the tab's previous changeset
// revision, so an editor notices one it missed (CS21).
export type ChangesetRoomOp = {
  kind: 'changeset';
  tabId: string;
  id: string;
  rev: number;
  prevRev: number | null;
  author: ChangesetAuthor;
  agentKey?: string;
  summary?: string;
  counts: ChangesetCounts;
  elementOps?: ElementOp[];
  touched?: string[];
  refetch?: true;
  tab?: Omit<Tab, 'elements'>;
  revertOf?: string;
};
