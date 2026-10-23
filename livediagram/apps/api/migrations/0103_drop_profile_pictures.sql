-- Profile pictures go (docs/specs/014-identity/auth-and-guest-access.md): liveworkspace accounts have none, so the
-- Clerk image URLs 0058 published have nothing left to show. Both columns are only ever read for pictures.
--
-- participants.picture_url: a participant's published Clerk image URL. Nothing reads it now, and the URLs point at
-- Clerk's image host, which no page loads any more.
-- ws_tickets.account: whether a ticket was minted by a verified session, read only to decide who saw pictures.
-- Tickets live a minute, so dropping it loses nothing a socket still needs.
ALTER TABLE participants DROP COLUMN picture_url;
ALTER TABLE ws_tickets DROP COLUMN account;
