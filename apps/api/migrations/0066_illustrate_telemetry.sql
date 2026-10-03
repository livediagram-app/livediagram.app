-- Infographic mode is Illustrate mode (docs/specs/007-editor/editor-modes.md "Telemetry"): its
-- events were renamed with it. The stored history moves with them, so the public dashboard's lines
-- continue under the new names.
UPDATE events SET type = 'ModeIllustrate' WHERE category = 'Editor' AND action = 'Changed' AND type = 'ModeInfographic';
UPDATE events SET type = 'OpensInIllustrate' WHERE category = 'Tab' AND action = 'Changed' AND type = 'OpensInInfographic';
UPDATE events SET type = 'IllustrateModeOn' WHERE category = 'UI' AND action = 'Toggled' AND type = 'InfographicModeOn';
UPDATE events SET type = 'IllustrateModeOff' WHERE category = 'UI' AND action = 'Toggled' AND type = 'InfographicModeOff';
