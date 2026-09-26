-- docs/specs/014-identity/transactional-email.md (#3): track that we've sent the "your API token expires soon" email
-- for a token, so the daily cron warns once (7 days out) and never repeats.
-- NULL = not yet warned. Cleared implicitly when the token row is deleted
-- (account deletion / revoke-and-recreate gets a fresh row).
ALTER TABLE api_tokens ADD COLUMN expiry_warned_at INTEGER;
