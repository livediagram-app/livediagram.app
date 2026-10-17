// Home's first run (docs/specs/013-workspace/explorer-home.md "First run"), pure: when a person has nothing yet, the
// copy the page speaks with, and where its searches lead. The starts themselves (template picks) are
// first-run-starts.ts, kept apart so the hero, on every Home, never loads the template catalogue.

/** Nothing yet: once the lists have loaded, no document of their own, shared, in a team or in this browser. */
export function isFirstRun(input: {
  loading: boolean;
  documents: number;
  shared: number;
  teamDocuments: number;
  offlineDocuments: number;
}): boolean {
  return (
    !input.loading &&
    input.documents === 0 &&
    input.shared === 0 &&
    input.teamDocuments === 0 &&
    input.offlineDocuments === 0
  );
}

/** The wizard, its template search opened on the words; the wizard alone for none. */
export function welcomeSearchHref(words: string): string {
  const q = words.trim();
  return q ? `/new?q=${encodeURIComponent(q)}` : '/new';
}

/** The field's Start Blank: a blank diagram at once. */
export const WELCOME_START_BLANK_HREF = '/new?blank=1';

/** The wizard, for Browse All Templates. */
export const WELCOME_ALL_TEMPLATES_HREF = '/new';

export const WELCOME_COPY = {
  greeting: 'Welcome to livediagram.',
  question: 'What are you making first?',
  lead: 'Pick a starting point, or search the templates. Whatever you make lands here, ready to pick up again.',
  pillFree: 'Free and open source',
  pillGuest: 'No sign-up to start',
  pillSignedIn: 'Saved to your account',
  searchPlaceholder: 'Search templates',
  searchLabel: 'Search templates',
  startBlank: 'Start Blank',
  blanksTitle: 'Start Blank',
  popularTitle: 'Popular Templates',
  allTemplates: 'Browse All Templates',
  haveWorkTitle: 'Already Have Work?',
  signInTitle: 'Nothing here yet? Sign in',
  signInLine: 'If you have used livediagram before, sign in and your documents come back with you.',
  signIn: 'Sign In',
  importTitle: 'Bring It With You',
  importLine:
    'Import boards from Miro, draw.io, Excalidraw or Microsoft Whiteboard; each becomes its own document.',
} as const;
