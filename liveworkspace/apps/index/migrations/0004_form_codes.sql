-- A live form's public code (src/collab-push.ts pushForm), so the app's server finds the item and tab a code
-- names (`GET /app/forms/:code`) without keeping a table of its own. Only live links carry one: a link deleted
-- or suspended takes its form off the Inbox, and its code with it.
ALTER TABLE collab_forms ADD COLUMN code TEXT NULL;
CREATE UNIQUE INDEX collab_forms_code ON collab_forms (code) WHERE code IS NOT NULL;
