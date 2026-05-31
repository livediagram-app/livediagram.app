-- Track which diagrams a non-owner has accessed via a share link, so
-- the live app can render a "Shared with you" accordion in the
-- Explorer (spec/15 / item #8 on the post-prototype feature haul).
--
-- Each row says "owner OWNER_ID has opened diagram DIAGRAM_ID at
-- least once via a share link, most recently at LAST_SEEN, under
-- ROLE." Primary key on (owner_id, diagram_id) keeps the table
-- idempotent — repeat visits just bump last_seen.
--
-- Cascades through diagrams: revoking a diagram (account delete,
-- explicit removal) drops every visitor's reference for free.
CREATE TABLE shared_with (
  owner_id TEXT NOT NULL,
  diagram_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('edit', 'view')),
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (owner_id, diagram_id),
  FOREIGN KEY (diagram_id) REFERENCES diagrams(id) ON DELETE CASCADE
);

CREATE INDEX shared_with_by_owner ON shared_with(owner_id, last_seen DESC);
