-- The link a visit came in through (docs/specs/013-workspace/share-roles.md "Share links"): a visit opens the
-- document through that link only while it is live, so revoking it ends the visits it granted. NULL for visits
-- recorded before this column, which keep the older rule (the oldest live link of their role and scope) until
-- their next open records one.
ALTER TABLE shared_with ADD COLUMN share_code TEXT NULL;

-- Revoking a link deletes the visits it granted: found by document and code.
CREATE INDEX shared_with_document_code_idx ON shared_with(document_id, share_code);
