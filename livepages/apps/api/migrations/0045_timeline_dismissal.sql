-- Per-entry dismissal on the Timeline (docs/specs/013-workspace/timeline.md §2.9).
--
-- A reader can take one card off THEIR feed from its ⋯ menu. The event
-- row is shared by everybody it was scoped to (one comment, N
-- memberships), so the dismissal lives on the membership row, not the
-- event: a teammate removing a card from their feed leaves it on yours.
--
-- Soft, not a row delete, on purpose. `attachEventToScopes` is INSERT OR
-- IGNORE against the composite key, so a dismissed membership survives a
-- re-emit; deleting the row instead would let the coalesced editing event
-- (which upserts and re-attaches on every save) resurrect a card the
-- reader had just removed.

ALTER TABLE timeline_event_scopes ADD COLUMN deleted_at INTEGER;
