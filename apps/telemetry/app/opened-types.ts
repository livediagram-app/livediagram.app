// How the dashboard reads UI·Opened types (spec/22), shared by the Dialogs &
// Panels charts and the rankings that break them down (the Settings tab's
// Categories Opened, the Help tab's Opened From the Editor). Kept out of the
// catalogue, which exports only charts and stacks.

// A category picked inside the open Settings dialog (`Settings<Category>`),
// as against the dialog itself opening (`Settings`). One visit that looks
// through three categories is one open and three of these.
export const isSettingsCategory = (type: string | null): boolean =>
  type !== 'Settings' && (type ?? '').startsWith('Settings');

// A help article opened from inside the editor: its telemetry id is the
// article's lowercase slug, where every other UI·Opened type is PascalCase.
export const isHelpArticleType = (type: string | null): boolean => /^[a-z]/.test(type ?? '');
