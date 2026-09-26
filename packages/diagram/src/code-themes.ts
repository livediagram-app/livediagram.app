// Code-block colour schemes (docs/specs/009-elements/code-block.md).
//
// The card shipped as one fixed dark look, deliberately: a code block reads as
// an editor window, so it ignores the element's fill / stroke / theme the way
// a sticky stays amber. That was right about WHERE the colours come from and
// wrong about how many there are. A block dropped on a light, warm board, or
// next to a screenshot from someone's own editor, wants to match it, and the
// only honest way to offer that is a small set of complete schemes rather than
// a fill swatch that would let you paint the card pink and leave the syntax
// colours unreadable on it.
//
// Every colour of a card lives in one entry here, so the canvas view, the
// headless SVG render (exports, thumbnails, the MCP render) and the preset
// tiles all paint the same scheme. The ids are stored on the element, so they
// are permanent: rename a `name`, never an `id`.

export type CodeThemeId =
  'midnight' | 'graphite' | 'ocean' | 'forest' | 'plum' | 'contrast' | 'paper' | 'parchment';

export type CodeTheme = {
  id: CodeThemeId;
  /** Title Case, shown on the preset tile. */
  name: string;
  /** The card. */
  surface: string;
  border: string;
  /** Ordinary code, and the dimmer ink for the language badge + placeholder. */
  text: string;
  muted: string;
  /** Syntax tokens. `comment` is usually `muted`, kept separate so a scheme
   *  can tint its comments without dimming the badge with them. */
  keyword: string;
  string: string;
  comment: string;
  number: string;
};

/** The scheme a code block gets when it carries no `codeTheme`. It is the look
 *  the element shipped with, so every block made before this existed keeps
 *  exactly the card it had. */
export const DEFAULT_CODE_THEME: CodeThemeId = 'midnight';

// Ordered dark-first, because that is what a code block is expected to look
// like; the two light schemes sit at the end where someone looking for them
// will find them together.
export const CODE_THEMES: readonly CodeTheme[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    surface: '#0f172a',
    border: '#334155',
    text: '#e2e8f0',
    muted: '#64748b',
    keyword: '#93c5fd',
    string: '#86efac',
    comment: '#64748b',
    number: '#fca5a5',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    surface: '#18181b',
    border: '#3f3f46',
    text: '#e4e4e7',
    muted: '#71717a',
    keyword: '#a5b4fc',
    string: '#bef264',
    comment: '#71717a',
    number: '#fdba74',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    surface: '#082f49',
    border: '#075985',
    text: '#e0f2fe',
    muted: '#0ea5e9',
    keyword: '#7dd3fc',
    string: '#6ee7b7',
    comment: '#0284c7',
    number: '#fda4af',
  },
  {
    id: 'forest',
    name: 'Forest',
    surface: '#052e16',
    border: '#166534',
    text: '#dcfce7',
    muted: '#22c55e',
    keyword: '#86efac',
    string: '#fde68a',
    comment: '#15803d',
    number: '#fca5a5',
  },
  {
    id: 'plum',
    name: 'Plum',
    surface: '#3b0764',
    border: '#6b21a8',
    text: '#f3e8ff',
    muted: '#a855f7',
    keyword: '#d8b4fe',
    string: '#fbcfe8',
    comment: '#7e22ce',
    number: '#fde68a',
  },
  {
    id: 'contrast',
    name: 'Contrast',
    surface: '#000000',
    border: '#52525b',
    text: '#ffffff',
    muted: '#a1a1aa',
    keyword: '#67e8f9',
    string: '#bef264',
    comment: '#a1a1aa',
    number: '#fda4af',
  },
  {
    id: 'paper',
    name: 'Paper',
    surface: '#ffffff',
    border: '#e2e8f0',
    text: '#0f172a',
    muted: '#94a3b8',
    keyword: '#1d4ed8',
    string: '#15803d',
    comment: '#94a3b8',
    number: '#b91c1c',
  },
  {
    id: 'parchment',
    name: 'Parchment',
    surface: '#fefce8',
    border: '#fde68a',
    text: '#422006',
    muted: '#a16207',
    keyword: '#9a3412',
    string: '#3f6212',
    comment: '#a16207',
    number: '#9f1239',
  },
];

const BY_ID = new Map(CODE_THEMES.map((t) => [t.id, t]));

/** The scheme for a stored id, falling back to the default for an absent or
 *  unknown one so an older / hand-edited file still renders a card. */
export function codeTheme(id: string | undefined): CodeTheme {
  return (id ? BY_ID.get(id as CodeThemeId) : undefined) ?? BY_ID.get(DEFAULT_CODE_THEME)!;
}

export function isCodeThemeId(id: string | undefined): id is CodeThemeId {
  return id !== undefined && BY_ID.has(id as CodeThemeId);
}
