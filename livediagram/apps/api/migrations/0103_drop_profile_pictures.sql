-- Profile pictures go (docs/specs/014-identity/auth-and-guest-access.md): liveworkspace accounts have none, so the
-- Clerk image URLs 0058 published have nothing left to show.
--
-- ws_tickets.account: whether a ticket was minted by a verified session, read only to decide who saw pictures.
-- Tickets live a minute, so dropping it loses nothing a socket still needs.
ALTER TABLE ws_tickets DROP COLUMN account;
