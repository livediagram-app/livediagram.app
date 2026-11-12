// Selection-mode illustrations (docs/specs/018-help/help-app.md): the palette's canvas-tool picker
// as the editor actually draws it (a trigger at the start of the palette strip that
// opens a tile grid in three bands), the panels each tool opens while it is
// active. The per-mode canvas scenes in
// palette-modes.tsx put PickerTrigger on top, so every selection-mode article
// shows the same picker with its own tool chosen.
//
// Labels are lifted from apps/live: canvas-tool-options.tsx (tool names,
// shortcuts, bands), the *-config.ts catalogues (panel rows and values), and
// TopCenterChrome.tsx (the Format banner).

// The picker lives in selection-modes-picker.tsx and the tool panels in selection-modes-panels.tsx.
export { PickerTrigger, ToolPicker } from './selection-modes-picker';
export {
  EraserPanelScene,
  FormatPanelScene,
  LaserPanelScene,
  SpotlightPanelScene,
  SpotlightTool,
} from './selection-modes-panels';
