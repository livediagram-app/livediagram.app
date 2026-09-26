-- docs/specs/006-diagram/diagram-snapshots.md: freshness marker for a diagram's cached SVG snapshot. The
-- snapshot bytes live in R2 (key `thumb/<diagramId>`); this column
-- records when they were last rendered so the render-on-read path can
-- tell a stale snapshot (saved_at > thumb_rendered_at) it must
-- re-render from a fresh one it can stream straight from R2. NULL =
-- never rendered. No backfill: the first read of each diagram renders +
-- caches lazily.
ALTER TABLE diagrams ADD COLUMN thumb_rendered_at INTEGER;
