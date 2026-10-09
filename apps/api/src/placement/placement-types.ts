// The shapes placement on create works with (docs/specs/013-workspace/blueprints/document-placement.md,
// docs/specs/013-workspace/blueprints/default-folders.md), shared by the resolver, its steps, the
// lookups and the log.

import type {
  CreationIntent,
  DocumentPlacement,
  PlacementDefaultKey,
  PlacementRejection,
} from '@livediagram/api-schema';

/** The placement a create body asks for. `chosen` is whether the caller chose a place at all: a
 *  team, or the `folderId` key present (null being the space's root, chosen on purpose). A body
 *  with neither is no choice, where a default folder may answer. */
export type RequestedPlacement = DocumentPlacement & { chosen: boolean };

/** Who is creating: the hybrid owner (guest or account) and the verified account id, if any. Team
 *  membership is only ever read against `verifiedUserId`, never the guest header. */
export type PlacementCaller = { ownerId: string; verifiedUserId: string | null };

/** The folder fields placement reads. */
export type PlacementFolder = { ownerId: string; teamId: string | null };

/** The reads the resolver needs, injected so it stays free of `env`. */
export type PlacementLookups = {
  isJoinedMember(teamId: string, userId: string): Promise<boolean>;
  getFolder(folderId: string): Promise<PlacementFolder | null>;
  /** The owner's default folders, by key in force. */
  getPlacementDefaults(ownerId: string): Promise<ReadonlyMap<PlacementDefaultKey, string>>;
};

/** Why a default was passed over: it dangles. */
export type DefaultSkipReason = 'folder_missing' | 'folder_not_visible' | 'team_not_joined';

export type DefaultSkip = { key: PlacementDefaultKey; reason: DefaultSkipReason };

/** Which folder step decided, and for a default, which key. */
export type PlacementDecision =
  { via: 'explicit' | 'root' } | { via: 'default'; key: PlacementDefaultKey };

/** What one folder step answers: a placement, a refusal, or null to pass to the next step. */
export type FolderStepAnswer =
  | ({ ok: true; placement: DocumentPlacement } & PlacementDecision)
  | { ok: false; rejection: PlacementRejection };

/** The resolver's answer. A placement carries every default skipped on the way to it. */
export type PlacementOutcome =
  | ({ ok: true; placement: DocumentPlacement; skipped: DefaultSkip[] } & PlacementDecision)
  | { ok: false; rejection: PlacementRejection };

export type FolderStepInput = {
  requested: RequestedPlacement;
  intent: CreationIntent | null;
  caller: PlacementCaller;
  lookups: PlacementLookups;
  /** Where a step records the defaults it passed over. */
  skipped: DefaultSkip[];
};

/** One rung of folder resolution. */
export type FolderStep = (input: FolderStepInput) => Promise<FolderStepAnswer | null>;
