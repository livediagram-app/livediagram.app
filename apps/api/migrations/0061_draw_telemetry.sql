-- Draw mode's events are the Draw category (docs/specs/007-editor/editor-modes.md "Telemetry"):
-- the category was named Whiteboard while whiteboarding was a tab kind. The stored history moves
-- with it, so the public dashboard's lines continue under the new name.
UPDATE events SET category = 'Draw' WHERE category = 'Whiteboard';
