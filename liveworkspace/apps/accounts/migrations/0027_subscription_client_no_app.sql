-- The subscription Worker's staging OAuth client is a platform service, not an app (accounts.md "Which app a client
-- is"). It was registered on 2026-11-25, before registration took `app: null`, filed as liveplanner.app, which let it
-- reach liveplanner's own routes. Removing its row makes it no app: every per-app route refuses it, and the teams,
-- profiles and tokens routes it uses serve it as before. Written by hand, like 0005. The id is staging's alone, so
-- elsewhere this deletes nothing.
DELETE FROM oauth_client_app WHERE clientId = 'LnDEBCAkZNCZwcuFPFqplZeZWsQkHlUl';
