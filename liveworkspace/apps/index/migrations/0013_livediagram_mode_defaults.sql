-- livediagram files every new canvas by the mode it opens in alone (liveworkspace/docs/specs/004-index/
-- one-explorer-contracts.md "Mode-only apps"): its Default Folders are Diagrams, Drawings and Workshops, and the index
-- no longer reads its app-level key (`livediagram`, "Canvases"), its kind keys (`livediagram:kind:event-storming`) or
-- its template keys (`livediagram:template:retrospective`).
--
-- Defaults are per person (never per team). For each person with an app-level default, that folder fills each of the
-- three mode keys they hold none of (INSERT OR IGNORE on the primary key keeps a mode default already set), so new
-- canvases keep landing where they did. Then every livediagram app-level, kind and template row goes.

INSERT OR IGNORE INTO placement_defaults (person_id, default_key, folder_id, updated_at)
SELECT d.person_id, 'livediagram:mode:' || m.mode, d.folder_id, d.updated_at
FROM placement_defaults d
CROSS JOIN (SELECT 'diagram' AS mode UNION ALL SELECT 'draw' UNION ALL SELECT 'workshop') m
WHERE d.default_key = 'livediagram';

DELETE FROM placement_defaults
WHERE default_key = 'livediagram'
   OR default_key LIKE 'livediagram:kind:%'
   OR default_key LIKE 'livediagram:template:%';
