// The dashboard's top-level views (docs/specs/017-telemetry/telemetry.md), shared by the tab row in the page
// shell and anything that links to a view (a stack's See also footer).
export type ViewKey = 'dashboard' | 'features' | 'pages' | 'health' | 'search';

// The sections the Detail tabs gather (each was its own tab until October 2026). A stack's See also
// names a section; following it opens the section's tab and scrolls the section into view.
export type SectionKey =
  | 'editing'
  | 'palette'
  | 'modes'
  | 'lookfeel'
  | 'settings'
  | 'facilitation'
  | 'connections'
  | 'pages'
  | 'help'
  | 'tours'
  | 'exceptions'
  | 'timings';

export const SECTION_TAB: Record<SectionKey, ViewKey> = {
  editing: 'features',
  palette: 'features',
  modes: 'features',
  lookfeel: 'features',
  settings: 'features',
  facilitation: 'features',
  connections: 'features',
  pages: 'pages',
  help: 'pages',
  tours: 'pages',
  exceptions: 'health',
  timings: 'health',
};

// The id a section's heading carries, for its See also links and the tab's section links.
export const sectionId = (key: SectionKey): string => `section-${key}`;
