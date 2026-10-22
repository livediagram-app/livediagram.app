-- Composite indexes for hot read paths (perf review). No schema or
-- data changes, indexes only.

-- 1. team_members(team_id, user_id): getMembership runs on the
--    team-diagram access hot path (canReadDiagram / canEditDiagram on
--    every team-diagram read and autosave). The existing single-column
--    team_members_user_idx / team_members_team_idx force a seek on one
--    column then a filter on the other; this composite resolves the
--    (team_id, user_id) lookup in a single exact seek.
CREATE INDEX team_members_team_user_idx ON team_members (team_id, user_id);

-- 2. share_links primary-code derivation. The diagram list + "shared
--    with you" endpoints derive each row's primary share code via a
--    correlated subquery:
--      WHERE diagram_id = ? [AND role = ?] ORDER BY created_at ASC LIMIT 1
--    With only idx_share_links_diagram(diagram_id) SQLite seeks by
--    diagram_id then SORTS the matches to satisfy ORDER BY created_at.
--    These composites carry created_at (and role) in the index so the
--    ordered LIMIT 1 is answered from the index alone, no sort. The
--    (diagram_id, created_at) index also supersedes the plain
--    diagram_id index (same leading column) for every other lookup.
DROP INDEX idx_share_links_diagram;
CREATE INDEX idx_share_links_diagram_created ON share_links (diagram_id, created_at);
CREATE INDEX idx_share_links_diagram_role_created ON share_links (diagram_id, role, created_at);
