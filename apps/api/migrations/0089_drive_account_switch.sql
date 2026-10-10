-- docs/specs/022-drive-mirror/drive-mirror.md "Reconnecting with another Google account": a consent by a
-- different Google account than google_account_id waits here for the owner to confirm or cancel the
-- switch. The sealed refresh token is sealed exactly as refresh_token_enc; the expiry is epoch ms
-- (DRIVE_ACCOUNT_SWITCH_TTL_MS after the consent). All three are NULL when no switch is pending.
ALTER TABLE drive_connections ADD COLUMN pending_refresh_token_enc TEXT;
ALTER TABLE drive_connections ADD COLUMN pending_google_account_id TEXT;
ALTER TABLE drive_connections ADD COLUMN pending_expires_at INTEGER;
