-- The devices an account gets phone notifications on (liveworkspace/docs/specs/003-accounts/push.md): one row per
-- browser push subscription, made when someone turns on phone notifications in any app's Settings, and serving every
-- app. Goes with the account. Written by hand, like 0002.
CREATE TABLE push_device (
  -- `pd_` and a random UUID's hex: what the Settings list removes a device by.
  id           TEXT    NOT NULL PRIMARY KEY,
  user_id      TEXT    NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  -- The push service's address for this subscription. A browser that subscribes again under another account moves
  -- its row to that account.
  endpoint     TEXT    NOT NULL UNIQUE CHECK (length(endpoint) BETWEEN 12 AND 1024),
  -- The subscription's keys, base64url: its P-256 public key (65 bytes) and its 16-byte auth secret.
  p256dh       TEXT    NOT NULL CHECK (length(p256dh) BETWEEN 86 AND 88),
  auth         TEXT    NOT NULL CHECK (length(auth) BETWEEN 22 AND 24),
  -- What the device list calls it, as the browser described itself ("Safari on iOS").
  label        TEXT    NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  -- Where it was turned on, which the list shows by its logo. The device hears from every app all the same.
  app          TEXT    NOT NULL DEFAULT 'liveworkspace' CHECK (
                 app IN ('liveworkspace', 'livediagram', 'liveplanner', 'livedocuments', 'livedesign')),
  created_at   INTEGER NOT NULL,
  -- When a push last reached its service; null until one has.
  last_sent_at INTEGER
);
-- An account's devices, newest first: the list, the cap's trim and the send's lookup.
CREATE INDEX push_device_user ON push_device (user_id, created_at);
