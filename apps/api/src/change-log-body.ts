// Defensive parser for the POST /api/documents/:id/log request body.
// Lifted out of the route handler in index.ts so the validation has
// a testable surface (the route itself is awkward to unit-test
// because of the env binding) and so the rules are documented in
// one place.
//
// Every audit-log row the live editor sends passes through this
// function. A regression that quietly accepts a missing field
// would write a malformed row to the change_log table, and the
// downstream readers (ActivityPanel, Revert) can't tell at render
// time whether a missing summary or empty elementIds is a genuine
// edge case or a corrupted insert. Pinning the contract here keeps
// the table consistent.

import type { ChangeLogEntryDTO } from './types';

// Returns a fully-typed entry when the body parses, or `null` when
// any required field is missing / malformed. The route handler
// surfaces null as a 400 with the canonical "missing change_log
// fields" message (see apps/api/src/responses.ts and the bad-input
// message contract).
//
// "Required" here mirrors the ChangeLogEntry DTO's required fields:
//   - id, participantId, participantName, participantColor must be
//     non-empty strings (truthy check rejects empty strings too).
//   - kind, summary must be non-empty strings.
//   - elementIds must be an array (any array, including empty: a
//     tab-meta entry like "renamed tab" carries no element ids).
//   - beforeState and afterState must be objects (typeof check;
//     `null` is treated as object by JS, current behaviour, and the
//     route handler coalesces both to `{}` downstream so the null
//     case is silently normalised).
//
// `tabId` is optional (Partial DTO field) and defaults to null on
// the way out. `createdAt` defaults to `Date.now()` so a client
// that didn't supply one gets the server's wall clock instead of
// undefined.
export function parseChangeLogEntryBody(
  body: Partial<ChangeLogEntryDTO>,
  now: number = Date.now(),
): ChangeLogEntryDTO | null {
  if (
    !body.id ||
    !body.participantId ||
    !body.participantName ||
    !body.participantColor ||
    !body.kind ||
    !body.summary ||
    !Array.isArray(body.elementIds) ||
    typeof body.beforeState !== 'object' ||
    typeof body.afterState !== 'object'
  ) {
    return null;
  }
  return {
    id: body.id,
    tabId: body.tabId ?? null,
    participantId: body.participantId,
    participantName: body.participantName,
    participantColor: body.participantColor,
    kind: body.kind,
    summary: body.summary,
    elementIds: body.elementIds,
    beforeState: (body.beforeState ?? {}) as Record<string, unknown>,
    afterState: (body.afterState ?? {}) as Record<string, unknown>,
    createdAt: body.createdAt ?? now,
  };
}
