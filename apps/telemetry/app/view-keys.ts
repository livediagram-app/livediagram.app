// The dashboard's top-level views (docs/specs/017-telemetry/telemetry.md), shared by the tab row in the page
// shell and anything that links to a view (a stack's See also footer).
export type ViewKey =
  | 'dashboard'
  | 'pages'
  | 'palette'
  | 'modes'
  | 'lookfeel'
  | 'editing'
  | 'help'
  | 'settings'
  | 'exceptions'
  | 'search';
