// One search for the template catalogue (docs/specs/008-canvas/canvas-and-palette.md "Template categories", Search),
// shared by the editor's template step and the marketing gallery so the two find the same templates: a template
// matches when every word typed is found, case, punctuation and hyphens ignored, in its title, description, kind, the
// labels of every category it is shown in, or its search words.
import type { TemplateDescriptor } from './templates';
import {
  templateCategories,
  templateCategoryLabel,
  templateCategorySearchWords,
} from './template-categories';
import { templateKeywords } from './template-keywords';

// Punctuation and hyphens are no part of a word here, on both sides: read as a space ("to-do" is "to do", "1-on-1" is
// "1 on 1"), or dropped within a word ("to-do" is "todo"), so a word typed either way finds it.
const PUNCTUATION = /[^\p{L}\p{N}\s]+/gu;
const spaced = (s: string): string =>
  s.toLowerCase().replace(PUNCTUATION, ' ').replace(/\s+/g, ' ').trim();
const joined = (s: string): string => s.toLowerCase().replace(PUNCTUATION, '');

type Haystack = { spaced: string; joined: string };
const HAYSTACKS = new Map<string, Haystack>();

// Built once per template and kept: the catalogue is fixed, and a search runs per keystroke over every template.
function haystack(t: Pick<TemplateDescriptor, 'kind' | 'title' | 'description'>): Haystack {
  let hay = HAYSTACKS.get(t.kind);
  if (hay === undefined) {
    const fields = [
      t.title,
      t.description,
      t.kind,
      ...templateCategories(t.kind).map(templateCategoryLabel),
      ...templateCategories(t.kind).map(templateCategorySearchWords),
      ...templateKeywords(t.kind),
    ];
    hay = { spaced: fields.map(spaced).join('\n'), joined: fields.map(joined).join('\n') };
    HAYSTACKS.set(t.kind, hay);
  }
  return hay;
}

/** The words of a query as typed, lower-cased; none for an empty one, or one of punctuation alone. */
export function templateQueryWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => joined(w) !== '');
}

/** True when every word of the query is found in the template's searchable text (an empty query matches all), its
 *  punctuation read as spaces or dropped ("to-do" finds "to do" and "todo"). */
export function templateMatchesQuery(
  t: Pick<TemplateDescriptor, 'kind' | 'title' | 'description'>,
  query: string,
): boolean {
  const words = templateQueryWords(query);
  if (words.length === 0) return true;
  const hay = haystack(t);
  return words.every((w) => hay.spaced.includes(spaced(w)) || hay.joined.includes(joined(w)));
}
