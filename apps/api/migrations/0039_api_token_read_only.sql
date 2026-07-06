-- Read-only API tokens (spec/61 §3.4 + spec/62 §4.11). A token minted with
-- read_only = 1 may only make GET/HEAD requests; the api rejects every write
-- (POST/PUT/DELETE) it presents. The MCP OAuth consent screen offers this so a
-- cautious user can let an AI tool VIEW their diagrams without granting edit.
-- Default 0 keeps every existing token full read+write.
ALTER TABLE api_tokens ADD COLUMN read_only INTEGER NOT NULL DEFAULT 0;
