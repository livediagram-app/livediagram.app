-- livehuddle, registered before its launch (liveworkspace/docs/specs/002-architecture/integrating-an-app.md
-- "Registered before launch"): the four columns that name an app take `livehuddle.app` (`livehuddle` for a phone
-- device). SQLite can't change a CHECK in place, so each table is rebuilt with the same columns, rows and indexes.
-- Written by hand, like 0002.
--
-- Each of the four is only ever a child (it references "user" or oauthClient; nothing references it), so dropping the
-- old table deletes nothing anywhere else: no ON DELETE CASCADE runs from it.

CREATE TABLE oauth_client_app_next (
  clientId TEXT NOT NULL PRIMARY KEY REFERENCES oauthClient ("clientId") ON DELETE CASCADE,
  -- The app's site id, as @liveworkspace/sites spells it.
  app      TEXT NOT NULL CHECK (app IN ('livediagram.app', 'liveplanner.app', 'livedocuments.app', 'livedesign.app',
                                        'livehuddle.app'))
) WITHOUT ROWID;
INSERT INTO oauth_client_app_next (clientId, app) SELECT clientId, app FROM oauth_client_app;
DROP TABLE oauth_client_app;
ALTER TABLE oauth_client_app_next RENAME TO oauth_client_app;

CREATE TABLE account_app_next (
  user_id             TEXT    NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  -- The app's site id, as @liveworkspace/sites spells it (and oauth_client_app).
  app                 TEXT    NOT NULL CHECK (app IN ('livediagram.app', 'liveplanner.app', 'livedocuments.app',
                                                      'livedesign.app', 'livehuddle.app')),
  first_seen_at       INTEGER NOT NULL,
  -- The app's one-time milestone emails, claimed before sending so a burst sends one: its tenth item,
  -- and its first share link.
  milestone_sent_at   INTEGER,
  first_share_sent_at INTEGER,
  PRIMARY KEY (user_id, app)
) WITHOUT ROWID;
INSERT INTO account_app_next (user_id, app, first_seen_at, milestone_sent_at, first_share_sent_at)
  SELECT user_id, app, first_seen_at, milestone_sent_at, first_share_sent_at FROM account_app;
DROP TABLE account_app;
ALTER TABLE account_app_next RENAME TO account_app;

CREATE TABLE email_lifecycle_next (
  user_id            TEXT    NOT NULL PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  -- When the account was made: the series' clock.
  created_at         INTEGER NOT NULL,
  -- Each stage's stamp, set when it is claimed (before sending) or skipped for someone who turned tips
  -- off; a failed send takes its stamp back.
  welcome_sent_at    INTEGER,
  week1_sent_at      INTEGER,
  week2_sent_at      INTEGER,
  activation_sent_at INTEGER,
  winback_sent_at    INTEGER,
  -- Failed sends in a row; at 3 the account leaves every due list (a dead address). A success resets it.
  send_attempts      INTEGER NOT NULL DEFAULT 0,
  last_attempt_at    INTEGER,
  -- The newest save on anything the person owns, in any app, as the apps report it: null until they
  -- first make something. The activation nudge and the win-back read it.
  active_at          INTEGER,
  -- Which app the sign-up came through (0009_signup_app.sql); null for an account made before it was recorded.
  signup_app         TEXT
    CHECK (signup_app IN ('livediagram.app', 'liveplanner.app', 'livedocuments.app', 'livedesign.app',
                          'livehuddle.app', 'liveworkspace.app'))
) WITHOUT ROWID;
INSERT INTO email_lifecycle_next (user_id, created_at, welcome_sent_at, week1_sent_at, week2_sent_at,
                                  activation_sent_at, winback_sent_at, send_attempts, last_attempt_at, active_at,
                                  signup_app)
  SELECT user_id, created_at, welcome_sent_at, week1_sent_at, week2_sent_at, activation_sent_at, winback_sent_at,
         send_attempts, last_attempt_at, active_at, signup_app
  FROM email_lifecycle;
DROP TABLE email_lifecycle;
ALTER TABLE email_lifecycle_next RENAME TO email_lifecycle;
-- One partial index per stage, holding only the accounts still owed it, so each due list reads just those.
CREATE INDEX email_lifecycle_welcome ON email_lifecycle (created_at) WHERE welcome_sent_at IS NULL;
CREATE INDEX email_lifecycle_week1 ON email_lifecycle (created_at) WHERE week1_sent_at IS NULL;
CREATE INDEX email_lifecycle_week2 ON email_lifecycle (created_at) WHERE week2_sent_at IS NULL;
CREATE INDEX email_lifecycle_activation ON email_lifecycle (created_at)
  WHERE activation_sent_at IS NULL AND week1_sent_at IS NULL AND active_at IS NULL;
CREATE INDEX email_lifecycle_winback ON email_lifecycle (active_at) WHERE winback_sent_at IS NULL;

CREATE TABLE push_device_next (
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
                 app IN ('liveworkspace', 'livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle')),
  created_at   INTEGER NOT NULL,
  -- When a push last reached its service; null until one has.
  last_sent_at INTEGER
);
INSERT INTO push_device_next (id, user_id, endpoint, p256dh, auth, label, app, created_at, last_sent_at)
  SELECT id, user_id, endpoint, p256dh, auth, label, app, created_at, last_sent_at FROM push_device;
DROP TABLE push_device;
ALTER TABLE push_device_next RENAME TO push_device;
-- An account's devices, newest first: the list, the cap's trim and the send's lookup.
CREATE INDEX push_device_user ON push_device (user_id, created_at);
