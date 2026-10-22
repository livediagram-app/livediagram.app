-- Profile pictures for collaborators (docs/specs/014-identity/profile-picture.md §6).
--
-- participants.picture_url: the participant's published picture, a Clerk image URL (never bytes).
-- Set only by the participant's own verified Clerk session through
-- PUT /api/participants/<id>/picture, null for guests, when the switch is off, and until the
-- first write. Deleted with the participant row on account deletion.
ALTER TABLE participants ADD COLUMN picture_url TEXT NULL;

-- ws_tickets.account: 1 when the ticket was minted by a verified Clerk session, so the realtime
-- room knows which sessions may publish a picture and which may receive one.
ALTER TABLE ws_tickets ADD COLUMN account INTEGER NOT NULL DEFAULT 0;
