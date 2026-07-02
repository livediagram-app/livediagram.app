-- One-time WebSocket room tickets (spec/11 "Realtime model"). Browsers
-- can't put auth headers on a WS upgrade, so the client first asks the
-- authenticated REST endpoint (POST /api/diagrams/:id/room-ticket) for a
-- short-lived single-use ticket carrying the server-resolved role, then
-- presents it as `?t=` on the upgrade. Closes the hole where a team
-- diagram's upgrade granted edit to any unverified `?o=<member-id>`
-- (member ids are visible to every teammate, so a removed member could
-- keep joining the room).
CREATE TABLE ws_tickets (
  ticket TEXT PRIMARY KEY,
  diagram_id TEXT NOT NULL,
  role TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
