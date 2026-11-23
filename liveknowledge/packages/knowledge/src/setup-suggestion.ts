// The reading of a model's reply to Describe to Set Up (docs/specs/030-knowledgebase/describe-to-set-up.md "The
// model"). The reply is untrusted text: every field is checked, what is over a bound is cut to it, and anything
// that is not what the shape asks for is dropped. What comes out is plain text in a tree no deeper and no larger
// than the bounds, which the editor only ever places as text.
import { COVER_GRADIENT_IDS, isPageIconId } from '@liveknowledge/document';
import {
  SETUP_MAX_DEPTH,
  SETUP_MAX_HEADINGS,
  SETUP_MAX_HEADING_CHARS,
  SETUP_MAX_PAGES,
  SETUP_MAX_SUMMARY_CHARS,
  SETUP_MAX_TITLE_CHARS,
} from './setup-limits';

export type SetupPage = {
  /** `p1`, `p2`, ... in tree order: the suggestion's own ids, never the model's. */
  id: string;
  title: string;
  summary: string;
  headings: string[];
  /** The id of the page it sits under, or null at the top. A parent always comes before its subpages. */
  parent: string | null;
  /** 1 at the top, at most SETUP_MAX_DEPTH. */
  depth: number;
  /** A line-art page icon's id, when the page has one (a structure's, never a model's ask). */
  icon?: string;
  /** A theme gradient cover (`theme-<name>`), when the page has one. */
  cover?: string;
};

export type SetupSuggestion = { name: string; pages: SetupPage[] };

/** A reply longer than this is not read: 4,000 tokens of JSON are under a tenth of it. */
export const SETUP_MAX_REPLY_CHARS = 60_000;
/** How many of the reply's page objects are looked at before the rest are ignored. */
const MAX_RAW_PAGES = 200;

/** One line of plain text: control characters and line breaks become spaces, runs of space collapse, and the text is
 *  cut at `max` without splitting a surrogate pair. Not a string: nothing. Describe Structure reads its reply with it
 *  too (page-structure.ts). */
export function plainLine(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const text = value
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return (last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut).trim();
}

const keyOf = (value: unknown): string | null =>
  typeof value === 'number' || typeof value === 'string' ? String(value).trim() || null : null;

type RawPage = {
  key: string;
  parent: string | null;
  title: string;
  summary: string;
  headings: string[];
  icon: string | undefined;
  cover: string | undefined;
};

/** The page icon an object holds if it is the shape of an icon id, else none. */
const iconOf = (value: unknown): string | undefined => (isPageIconId(value) ? value : undefined);
/** The cover a value names if it is one of the built-in theme gradients, else none: never a picture. */
const coverOf = (value: unknown): string | undefined =>
  typeof value === 'string' && (COVER_GRADIENT_IDS as readonly string[]).includes(value)
    ? value
    : undefined;

function rawPage(value: unknown, at: number): RawPage | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const page = value as Record<string, unknown>;
  const title = plainLine(page.title, SETUP_MAX_TITLE_CHARS);
  if (!title) return undefined;
  const headings = (Array.isArray(page.headings) ? page.headings : [])
    .map((heading) => plainLine(heading, SETUP_MAX_HEADING_CHARS))
    .filter(Boolean)
    .slice(0, SETUP_MAX_HEADINGS);
  return {
    key: keyOf(page.id) ?? `#${at}`,
    parent: keyOf(page.parent),
    title,
    summary: plainLine(page.summary, SETUP_MAX_SUMMARY_CHARS),
    headings,
    icon: iconOf(page.icon),
    cover: coverOf(page.cover),
  };
}

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

// The reply's object: what lies between its first `{` and its last `}` (a model may wrap it in a code fence or a
// sentence). When that does not parse (a reply cut off at the token ceiling), what can be saved is: each page is
// an object with no object inside it, so every complete `{...}` without a brace in it is tried on its own.
function replyObject(reply: string): { name: unknown; pages: unknown[] } | undefined {
  const text = reply.slice(0, SETUP_MAX_REPLY_CHARS);
  const from = text.indexOf('{');
  if (from < 0) return undefined;
  const whole = parsed(text.slice(from, text.lastIndexOf('}') + 1));
  if (whole && typeof whole === 'object' && !Array.isArray(whole)) {
    const { name, pages } = whole as Record<string, unknown>;
    return { name, pages: Array.isArray(pages) ? pages : [] };
  }
  const pages = (text.slice(from + 1).match(/\{[^{}]*\}/g) ?? []).map(parsed);
  const name = parsed(/"name"\s*:\s*("(?:[^"\\]|\\.)*")/.exec(text)?.[1] ?? '');
  return { name, pages };
}

/** The structure a reply proposes, or undefined when it holds no valid page (the caller says "Could Not Suggest a
 *  Structure"). At most SETUP_MAX_PAGES pages in tree order, SETUP_MAX_DEPTH levels; a page with no title, an
 *  unknown parent, a parent that leads back to itself, a level too deep or a sibling's title is left out, with
 *  its subpages. */
export function parseSetupSuggestion(reply: string): SetupSuggestion | undefined {
  const read = replyObject(reply);
  if (!read) return undefined;
  const byKey = new Map<string, RawPage>();
  for (const [at, value] of read.pages.slice(0, MAX_RAW_PAGES).entries()) {
    const page = rawPage(value, at);
    // The first page of an id keeps it.
    if (page && !byKey.has(page.key)) byKey.set(page.key, page);
  }
  const children = new Map<string | null, RawPage[]>();
  for (const page of byKey.values()) {
    const under = children.get(page.parent);
    if (under) under.push(page);
    else children.set(page.parent, [page]);
  }
  const pages: SetupPage[] = [];
  // Depth first from the top, so a page with an unknown parent, or in a ring of parents, is never reached.
  const place = (parentKey: string | null, parent: string | null, depth: number) => {
    const titles = new Set<string>();
    for (const page of children.get(parentKey) ?? []) {
      if (pages.length >= SETUP_MAX_PAGES) return;
      const title = page.title.toLocaleLowerCase('en');
      if (titles.has(title)) continue;
      titles.add(title);
      const id = `p${pages.length + 1}`;
      pages.push({
        id,
        title: page.title,
        summary: page.summary,
        headings: page.headings,
        parent,
        depth,
        ...(page.icon ? { icon: page.icon } : {}),
        ...(page.cover ? { cover: page.cover } : {}),
      });
      if (depth < SETUP_MAX_DEPTH) place(page.key, id, depth + 1);
    }
  };
  place(null, null, 1);
  if (pages.length === 0) return undefined;
  return { name: plainLine(read.name, SETUP_MAX_TITLE_CHARS), pages };
}
