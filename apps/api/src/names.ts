// The server half of the name cap (docs/specs/006-document/name-length.md): every
// diagram and tab name the worker stores passes through here, so API-token
// callers, MCP tools and copies meet the same NAME_MAX_LENGTH the editor applies.

import { NAME_MAX_LENGTH, truncateName } from '@livediagram/document';

export type CappedNameKind = 'document' | 'tab';

// Shortens a new or changed name with the shared truncateName. A name sent back
// identical to the stored one is left alone, so an autosave or reorder echoing
// a pre-cap over-long name never rewrites it (no retro-truncation).
export function capStoredName(
  incoming: string,
  stored: string | null,
  kind: CappedNameKind,
): string {
  if (stored !== null && incoming === stored) return incoming;
  const capped = truncateName(incoming);
  // Log only a real cut: past the cap once whitespace is collapsed the way
  // truncateName collapses it. Tidying spaces alone is not worth a line.
  const collapsed = [...incoming.replace(/\s+/gu, ' ').trim()].length;
  if (collapsed > NAME_MAX_LENGTH) {
    console.info(`[names] capped ${kind} name`, [...incoming].length, [...capped].length);
  }
  return capped;
}
