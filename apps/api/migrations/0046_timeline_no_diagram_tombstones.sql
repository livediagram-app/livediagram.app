-- A deleted diagram leaves no trace on the Timeline (docs/specs/013-workspace/timeline.md §3.5).
--
-- The "Diagram Deleted" card was dropped: from the feed's point of view a
-- deleted diagram never existed, so the rows already written are swept
-- along with it. Their membership rows go via ON DELETE CASCADE.

DELETE FROM timeline_events WHERE event_type = 'diagram_deleted';
