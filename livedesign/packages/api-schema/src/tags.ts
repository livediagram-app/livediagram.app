// Tags (docs/specs/013-workspace/tags.md): the wire types, the limits, and the rules both sides apply
// (the api enforces them; the client checks before it asks, so a refusal is only a race). Pure.

import { STANDARD_COLOUR_NAMES, isHexColour, type StandardColourName } from '@livepages/document';

/** How many tags one person can make (spec "A tag"). Safe range 50 to 500: every tag list is bounded by it. */
export const TAG_LIMIT = 100;
/** A tag's name, after trimming and collapsing whitespace, in characters. */
export const TAG_NAME_MAX = 32;
/** A tag id; the client mints UUIDs (36). */
const TAG_ID_MAX = 64;

/** A standard colour by name (a StandardColourName, drawn per appearance), or a custom `#rrggbb`. */
export type TagColour = string;

export type Tag = {
  id: string;
  name: string;
  colour: TagColour;
  createdAt: number;
};

/** One tag on one document. */
export type TagLink = { tagId: string; documentId: string };

/** `GET /api/tags`. */
export type TagsList = { tags: Tag[]; links: TagLink[] };

/** The refusals a tag write answers with, as the `error` of its body. */
export const TAG_ERRORS = {
  invalid: 'invalid_tag',
  nameTaken: 'tag_name_taken',
  limit: 'tag_limit',
} as const;

/** The hued standard colours, in the order a new tag takes them (spec "A tag"). */
const TAG_COLOUR_ORDER: readonly StandardColourName[] = [
  'blue',
  'green',
  'orange',
  'violet',
  'teal',
  'pink',
  'red',
  'yellow',
];

/** A colour a tag may hold: a standard colour's name, or a `#rrggbb`. */
export function isTagColour(v: unknown): v is TagColour {
  return (
    isHexColour(v) ||
    (typeof v === 'string' && (STANDARD_COLOUR_NAMES as readonly string[]).includes(v))
  );
}

/** A name trimmed, inner whitespace runs kept as one space; null when empty, too long, or not a string. */
export function normaliseTagName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const clean = name.trim().replace(/\s+/g, ' ');
  return clean && Array.from(clean).length <= TAG_NAME_MAX ? clean : null;
}

/** What two names are compared by: one name per person, ignoring case. */
export function tagNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** A tag id: a short string of URL-safe characters (the client mints UUIDs). */
export function isTagId(v: unknown): v is string {
  return (
    typeof v === 'string' && v.length > 0 && v.length <= TAG_ID_MAX && /^[A-Za-z0-9_-]+$/.test(v)
  );
}

/** The colour a new tag takes: the hued standard colour the tags use least, the earliest on a tie. */
export function nextTagColour(used: Iterable<TagColour>): StandardColourName {
  const counts = new Map<string, number>();
  for (const c of used) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best = TAG_COLOUR_ORDER[0]!;
  for (const c of TAG_COLOUR_ORDER) if ((counts.get(c) ?? 0) < (counts.get(best) ?? 0)) best = c;
  return best;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Tags alphabetically by name, the one order they list in everywhere. A new array. */
export function sortTags<T extends { name: string }>(tags: readonly T[]): T[] {
  return [...tags].sort((a, b) => collator.compare(a.name, b.name));
}
