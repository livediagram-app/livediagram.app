-- Optional per-diagram share password (spec/24). When set, any non-owner
-- opening a share link for this diagram must supply the password before the
-- api will resolve the diagram or honour reads / writes carried on that
-- share code. One password covers every share link the diagram has.
--
-- Stored in plain text on purpose: the owner reads it back and edits it on
-- the Share dialog, and the threat model is "stop drive-by URL guessing", not
-- cryptographic secrecy. It lives behind the owner-authenticated API and is
-- NEVER returned in the standard diagram DTO (only via the owner-only share
-- endpoints). NULL = no password (the default for every existing diagram).

ALTER TABLE diagrams ADD COLUMN share_password TEXT;
