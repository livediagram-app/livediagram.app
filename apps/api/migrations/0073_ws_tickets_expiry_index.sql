-- Every room-ticket mint sweeps expired rows (DELETE ... WHERE expires_at <= ?),
-- which scanned the whole table without this index. Keeps the sweep a range
-- read however many tickets are live.
CREATE INDEX IF NOT EXISTS ws_tickets_expires_at ON ws_tickets(expires_at);
