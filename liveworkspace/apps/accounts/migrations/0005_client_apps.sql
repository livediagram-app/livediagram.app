-- Which app each OAuth client is (liveworkspace/docs/accounts.md "Which app a client is"), so an app's
-- server reaches only what is its own: its own settings scope beside 'all', its own sightings and
-- milestones. Set when the client is registered (src/clients.ts); scripts/map-clients.ts sets it for a
-- client registered before. Written by hand, like 0002. A client without a row may still check tokens and
-- read the teams feed, but is refused anything that belongs to one app.
CREATE TABLE oauth_client_app (
  clientId TEXT NOT NULL PRIMARY KEY REFERENCES oauthClient ("clientId") ON DELETE CASCADE,
  -- The app's site id, as @liveworkspace/sites spells it.
  app      TEXT NOT NULL CHECK (app IN ('livediagram.app', 'liveplanner.app', 'livedocuments.app', 'livedesign.app'))
) WITHOUT ROWID;
