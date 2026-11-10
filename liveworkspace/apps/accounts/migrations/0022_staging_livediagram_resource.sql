-- Staging's livediagram client was registered while livediagram ran behind its workers.dev router (2026-10-25), so its
-- one resource is that router's API. The zone move (2026-10-26) re-bound its redirect URIs to staging.livediagram.app
-- but not its resource, so every guest hand-off and sign-in asking for https://staging.livediagram.app/api was refused
-- as invalid_resource (liveworkspace/docs/specs/003-accounts/accounts.md "Every client holds its app's resource").
-- Bind it to that resource too. Only a client holding the old router's resource matches, so on production and in local
-- development this changes nothing. The old binding stays: a refresh token granted for it keeps refreshing until it
-- lapses. Written by hand, like 0002.
INSERT INTO "oauthClientResource" ("id", "clientId", "resourceId", "createdAt")
SELECT lower(hex(randomblob(16))), r."clientId", 'https://staging.livediagram.app/api', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM "oauthClientResource" r
WHERE r."resourceId" = 'https://livediagram-router-staging.liveworkspace-easing509.workers.dev/api'
  AND EXISTS (SELECT 1 FROM "oauthResource" WHERE "identifier" = 'https://staging.livediagram.app/api')
  AND NOT EXISTS (
    SELECT 1 FROM "oauthClientResource" x
    WHERE x."clientId" = r."clientId" AND x."resourceId" = 'https://staging.livediagram.app/api'
  );
