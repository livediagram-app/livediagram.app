-- Who may open an item's share links (src/share-sign-in.ts, Work Tracker 1330 and 1331): one rule over every link
-- of the item, as its password is. `require_account` 1 admits signed-in accounts only, never a guest; `domains` (the
-- normalised names joined by one space, or null) admits only accounts whose verified email is at one of them, and
-- implies `require_account`. No row: anyone holding a link, as before. Goes with the item, and with its archiving.
CREATE TABLE share_sign_in (
  item_id         TEXT    PRIMARY KEY REFERENCES items (id) ON DELETE CASCADE,
  require_account INTEGER NOT NULL DEFAULT 0 CHECK (require_account IN (0, 1)),
  domains         TEXT    NULL,
  updated_at      INTEGER NOT NULL
);
