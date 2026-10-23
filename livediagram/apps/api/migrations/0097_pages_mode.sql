-- Illustrate mode is Pages mode (docs/specs/007-editor/editor-modes.md "Naming in the interface").
-- Tab bodies keep `"opensIn":"illustrate"`: every read goes through parseEditorMode, which reads it
-- as Pages. What is renamed here is what would otherwise be lost or split in two.

-- Telemetry history, so the public dashboard's lines continue under the new names: the mode
-- switch, opens-in, leave, tour, Settings and export events (ModeIllustrate, OpensInIllustrate,
-- LeaveIllustrateConfirmed, IllustrateTour*, IllustrateTourStep*, IllustrateModeOn/Off,
-- TemplateModeIllustrate, IllustratePNG ... IllustrateGIFPages). Error types name code, not
-- the product, and are left as they were.
UPDATE events SET type = replace(type, 'Illustrate', 'Pages')
  WHERE category IN ('Editor', 'Tab', 'UI', 'Document') AND type LIKE '%Illustrate%';

-- The help articles moved with the mode (docs/specs/018-help/help-app.md, "Renamed articles"):
-- the section's and the tour's views and votes continue under the new slugs, and their page views
-- under the new addresses.
UPDATE events SET type = CASE type
    WHEN 'illustrate' THEN 'pages-mode'
    WHEN 'illustrate-tour' THEN 'pages-tour'
  END
  WHERE category = 'Help' AND type IN ('illustrate', 'illustrate-tour');
UPDATE events
  SET type = replace(replace(type, '/canvas/illustrate/illustrate-tour', '/canvas/pages-mode/pages-tour'),
    '/canvas/illustrate', '/canvas/pages-mode')
  WHERE category = 'Page' AND action = 'View' AND type LIKE '%/canvas/illustrate%';
