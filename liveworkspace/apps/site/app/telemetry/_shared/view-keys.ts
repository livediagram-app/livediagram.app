// The dashboard's views (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard", The tabs), shared by
// the tab row and anything that links to a view (a stack's See also footer).

// The Detail tabs: one area each, in the row's order. An app shows the ones it has something for (detail-tabs.tsx):
// its people tab is `facilitation` or `teamwork` (its config's `teamwork.key`), and Modes and Explorer only where
// the app has them.
export const DETAIL_KEYS = [
  'editing',
  'palette',
  'modes',
  'lookfeel',
  'settings',
  'facilitation',
  'teamwork',
  'explorer',
  'community',
  'connections',
  'pages',
  'help',
  'tours',
  'exceptions',
  'timings',
  'vitals',
] as const;

export type DetailKey = (typeof DETAIL_KEYS)[number];

export type ViewKey = 'dashboard' | DetailKey | 'search';
