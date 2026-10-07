-- Per-network daily image budget (docs/specs/009-elements/images.md "Per-network daily budget").
-- The per-owner gallery caps can be sidestepped by uploading under many guest
-- identities, so uploads are also counted per caller network per UTC day. The
-- network is never stored: only a keyed hash of it (HMAC-SHA256), and rows
-- older than the previous day are deleted as new uploads are recorded.
CREATE TABLE network_upload_usage (
  network_hash TEXT NOT NULL,
  day INTEGER NOT NULL,
  images INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (network_hash, day)
);

-- The sweep deletes by day.
CREATE INDEX network_upload_usage_day ON network_upload_usage(day);
