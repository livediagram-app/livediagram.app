-- AI keys (liveworkspace/docs/specs/003-accounts/ai-keys.md): a person's own AI provider key and each team's, one
-- row per owner. The key itself is only ever here sealed (src/ai-keys/seal.ts): AES-GCM under a key derived for this
-- row from the Worker's AI_KEY_SECRET, which D1 never holds. Written by hand, like 0002.
--
-- No foreign key: an account's row goes with its settings when it closes (delete-account.ts), a team's in the batch
-- that deletes the team (teams/manage.ts deleteTeamRows).
CREATE TABLE ai_key (
  -- 'account' (owner_id a user id) or 'team' (owner_id a team id).
  owner_kind  TEXT    NOT NULL CHECK (owner_kind IN ('account', 'team')),
  owner_id    TEXT    NOT NULL,
  provider    TEXT    NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  model       TEXT    NOT NULL CHECK (length(model) BETWEEN 1 AND 100),
  -- `<version>.<salt>.<iv>.<ciphertext>`, base64url.
  sealed      TEXT    NOT NULL CHECK (length(sealed) BETWEEN 1 AND 2048),
  -- The master secret's version it was sealed under, so a rotation can find the rows still to re-seal.
  key_version INTEGER NOT NULL CHECK (key_version >= 1),
  -- The key's last four characters, for "Key Ending 4f2a"; '' for a value too short to show any of.
  hint        TEXT    NOT NULL CHECK (length(hint) <= 4),
  -- The account that set it, and when.
  set_by      TEXT    NOT NULL,
  set_at      INTEGER NOT NULL,
  PRIMARY KEY (owner_kind, owner_id)
) WITHOUT ROWID;

CREATE INDEX ai_key_version ON ai_key (key_version);
