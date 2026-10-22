-- Lookups by document and by author (docs/specs/015-api/api.md "Owner-keyed data"). Each of these
-- tables keys its rows by owner first, so a statement by document id or author id read the whole table:
--
-- - deleting a document (or purging it from the Trash) cascades into favourites, document_opens,
--   workbench_tickets and workbench_sessions by document_id, and each cascade scanned its table;
-- - the guest-to-account migration and account deletion find agent_changesets by author_id.
--
-- Measured on SQLite with 100,000 favourites: deleting one document's rows took 2.52 ms before, 0.003 ms after;
-- the other tables scanned the same way. apps/api/src/db/lookup-plans.test.ts pins the plans.
CREATE INDEX favourites_document_idx ON favourites (document_id);
CREATE INDEX document_opens_document_idx ON document_opens (document_id);
CREATE INDEX agent_changesets_author_idx ON agent_changesets (author_id);
CREATE INDEX workbench_tickets_document_idx ON workbench_tickets (document_id);
CREATE INDEX workbench_sessions_document_idx ON workbench_sessions (document_id);

-- The favourites primary key (owner_id, document_id) already serves every read by owner, so this index only
-- cost every star and unstar a second index write.
DROP INDEX idx_favourites_owner;
