-- Profile pictures for collaborators (the profile picture spec, retired with the columns in 0103).
--
-- ws_tickets.account: 1 when the ticket was minted by a verified Clerk session, so the realtime
-- room knows which sessions may publish a picture and which may receive one.
ALTER TABLE ws_tickets ADD COLUMN account INTEGER NOT NULL DEFAULT 0;
