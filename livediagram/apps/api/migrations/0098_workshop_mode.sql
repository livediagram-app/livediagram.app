-- Facilitate mode is Workshop mode (docs/specs/007-editor/editor-modes.md "Naming in the interface").
-- Tab bodies keep `"opensIn":"facilitate"`: every read goes through parseEditorMode, which reads it
-- as Workshop. What is renamed here is what would otherwise be lost or split in two.

-- Telemetry history, so the public dashboard's lines continue under the new names: the mode
-- switch, template-mode, default-folder, tour and Settings events (ModeFacilitate,
-- TemplateModeFacilitate, DefaultModeFacilitate, FacilitateTour*, FacilitateTourStep*,
-- FacilitateTourSeenOn/Off). GLOB is case-sensitive, so the facilitator's own events
-- (Facilitator..., Facilitation..., Facilitated...) are left alone. Error types name code, not the
-- product, and are left as they were.
UPDATE events SET type = replace(type, 'Facilitate', 'Workshop')
  WHERE category NOT IN ('Error', 'Help', 'Page') AND type GLOB '*Facilitate*'
    AND type NOT GLOB '*Facilitate[ds]*';

-- The help articles moved with the mode (docs/specs/018-help/help-app.md, "Renamed articles"):
-- the section's and the tour's views and votes continue under the new slugs, and their page views
-- under the new addresses.
UPDATE events SET type = CASE type
    WHEN 'facilitate-mode' THEN 'workshop-mode'
    WHEN 'facilitate-tour' THEN 'workshop-tour'
  END
  WHERE category = 'Help' AND type IN ('facilitate-mode', 'facilitate-tour');
UPDATE events
  SET type = replace(replace(type, '/canvas/facilitate-mode/facilitate-tour', '/canvas/workshop-mode/workshop-tour'),
    '/canvas/facilitate-mode', '/canvas/workshop-mode')
  WHERE category = 'Page' AND action = 'View' AND type LIKE '%/canvas/facilitate-mode%';
