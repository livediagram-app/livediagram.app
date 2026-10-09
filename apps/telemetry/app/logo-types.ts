// The Element·Changed types a logo page's tools send (docs/specs/007-editor/logo-pages.md
// "Telemetry"): their own card (Logo Tools Used), so Elements Changed leaves them out.
export const LOGO_TOOL_TYPES: readonly string[] = [
  'ShapesUnited',
  'ShapesSubtracted',
  'ShapesIntersected',
  'ShapesExcluded',
  'MirrorCopy',
  'StrokesTidiedUp',
  'TextTracking',
  'TextWeight',
  'TextCase',
  'TextArc',
];
