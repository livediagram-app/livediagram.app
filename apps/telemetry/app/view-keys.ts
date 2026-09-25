// The dashboard's top-level views (spec/22), shared by the tab row in the page
// shell and anything that links to a view (a stack's See also footer).
export type ViewKey =
  | 'dashboard'
  | 'pages'
  | 'palette'
  | 'lookfeel'
  | 'editing'
  | 'help'
  | 'settings'
  | 'exceptions'
  | 'search';
