// The apps the one help centre serves, and its scopes (liveworkspace/docs/specs/017-help/help-centre.md). Every article
// names the apps it applies to; a scope is one app's help, or All Apps. Data-free: the names and words here are the
// help centre's own, so a page that only labels or links an app never loads a catalogue.

/** An app the help centre serves, by its id (the brand's and the index's app name). */
export type AppId = 'livediagram' | 'liveplanner' | 'livedocuments' | 'livedesign' | 'livehuddle';

/** The registry's app order: how the Applies To row, the notes under All Apps and every app list read. */
export const APP_ORDER: readonly AppId[] = [
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
  'livehuddle',
];

/** What a help page is built for: one app's help, or All Apps on liveworkspace.app. */
export type HelpScope = AppId | 'all';

/** Every scope, the apps first, as the build makes them. */
export const HELP_SCOPES: readonly HelpScope[] = [...APP_ORDER, 'all'];

export function isAppId(value: unknown): value is AppId {
  return typeof value === 'string' && (APP_ORDER as readonly string[]).includes(value);
}

export function isHelpScope(value: unknown): value is HelpScope {
  return value === 'all' || isAppId(value);
}

/** `apps` in registry order, each once: the order an article's or a category's apps are kept in. */
export function inAppOrder(apps: Iterable<AppId>): AppId[] {
  const set = new Set(apps);
  return APP_ORDER.filter((app) => set.has(app));
}

/** How the help centre names an app's work: the Explorer's words, as prose reads them. */
export interface AppWords {
  /** The work, singular and in running text: `canvas`, `plan`, `Space`. */
  noun: string;
  /** The work, plural: `canvases`, `Spaces`. */
  nouns: string;
}

// The words the Explorer uses for one item (@liveworkspace/sites APP_ITEMS), lower case as running text writes them,
// except livehuddle's Space, a name the product spells with its capital. "file" is every app's at once.
export const SCOPE_WORDS: Record<HelpScope, AppWords> = {
  livediagram: { noun: 'canvas', nouns: 'canvases' },
  liveplanner: { noun: 'plan', nouns: 'plans' },
  livedocuments: { noun: 'document', nouns: 'documents' },
  livedesign: { noun: 'design', nouns: 'designs' },
  livehuddle: { noun: 'Space', nouns: 'Spaces' },
  all: { noun: 'file', nouns: 'files' },
};

/** An app's name as it is written, lower case like its logo; "every app" for All Apps. */
export function scopeName(scope: HelpScope): string {
  return scope === 'all' ? 'every app' : scope;
}

/** The label the app switch and the result groups give a scope: the app's name, or "All Apps". */
export function scopeLabel(scope: HelpScope): string {
  return scope === 'all' ? 'All Apps' : scope;
}

/** The apps in a list read as prose: "livediagram", "livediagram and liveplanner", "a, b and c". */
export function appList(apps: readonly AppId[]): string {
  if (apps.length <= 1) return apps.join('');
  return `${apps.slice(0, -1).join(', ')} and ${apps[apps.length - 1]}`;
}
