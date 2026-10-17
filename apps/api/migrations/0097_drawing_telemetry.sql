-- Draw mode is Drawing mode (docs/specs/007-editor/editor-modes.md "Telemetry"): its category, its
-- mode switch, its tour and its help articles were renamed with it. The stored history moves with
-- them, so the public dashboard's lines continue under the new names.
UPDATE events SET category = 'Drawing' WHERE category = 'Draw';
UPDATE events SET type = 'ModeDrawing' WHERE category = 'Editor' AND action = 'Changed' AND type = 'ModeDraw';
UPDATE events SET type = 'DrawingTour' || substr(type, 9) WHERE category = 'UI' AND type LIKE 'DrawTour%';
UPDATE events SET type = 'drawing-mode' WHERE category = 'Help' AND type = 'draw-mode';
UPDATE events SET type = 'drawing-tour' WHERE category = 'Help' AND type = 'draw-tour';
