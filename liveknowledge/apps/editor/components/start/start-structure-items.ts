// What the knowledgebase's start screen offers (docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen"): shapes of a whole knowledgebase. Start (Blank Knowledgebase, and Describe to Set Up where it is offered),
// then the structures by who they are for, and the search across them. Pure: the panel draws what these return.
import {
  SETUP_STRUCTURES,
  STRUCTURE_GROUPS,
  setupStructure,
  type SetupStructure,
  type StructurePage,
} from '@liveknowledge/knowledge';

// The start's first group, and the ids of its two cards.
export const START_GROUP_ID = 'start';
export const BLANK_KNOWLEDGEBASE = 'blank';
export const DESCRIBE_TO_SET_UP = 'describe';

export type StartGroup = { id: string; name: string; line: string; ids: readonly string[] };
export type KnowledgebaseStart = {
  groups: readonly StartGroup[];
  // Every match, each once, under its group, in rail order.
  search: (query: string) => { group: string; ids: string[] }[];
};

const words = (text: string) => text.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();

// Every page title in a structure, at every level.
const titlesOf = (pages: readonly StructurePage[]): string[] =>
  pages.flatMap((page) => [page.title, ...titlesOf(page.pages)]);

/** How many pages a structure makes. */
export const structurePageCount = (structure: SetupStructure): number =>
  titlesOf(structure.pages).length;

// What a search reads of each card: its name and line, and a structure's page titles.
const BLANK_TEXT = 'Blank Knowledgebase empty start from nothing';
const DESCRIBE_TEXT = 'Describe to Set Up AI describe suggest a structure';
const textOf = (id: string): string => {
  if (id === BLANK_KNOWLEDGEBASE) return BLANK_TEXT;
  if (id === DESCRIBE_TO_SET_UP) return DESCRIBE_TEXT;
  const s = setupStructure(id)!;
  return [s.name, s.line, ...titlesOf(s.pages)].join(' ');
};

/** The start's groups, with Describe to Set Up in Start only where it is offered. */
export function knowledgebaseStart(offer: { describe: boolean }): KnowledgebaseStart {
  const groups: StartGroup[] = [
    {
      id: START_GROUP_ID,
      name: 'Start',
      line: 'An empty knowledgebase to shape yourself, or one the AI suggests from a description.',
      ids: [BLANK_KNOWLEDGEBASE, ...(offer.describe ? [DESCRIBE_TO_SET_UP] : [])],
    },
    ...STRUCTURE_GROUPS.map((g) => ({
      id: g.id,
      name: g.name,
      line: g.line,
      ids: SETUP_STRUCTURES.filter((s) => s.group === g.id).map((s) => s.id),
    })),
  ];
  const search = (query: string) => {
    const q = words(query).split(' ').filter(Boolean);
    return groups
      .map((g) => ({
        group: g.id,
        ids: g.ids.filter((id) => {
          const text = words(textOf(id));
          return q.every((w) => text.includes(w));
        }),
      }))
      .filter((g) => g.ids.length > 0);
  };
  return { groups, search };
}

/** A structure's outline, two levels: each top page, with its subpages' titles after it. At most `max` lines: past
 *  that, one line fewer and the rest counted on the last. */
export function structureOutline(
  structure: SetupStructure,
  max = 5,
): { lines: { title: string; under: string[] }[]; more: number } {
  const all = structure.pages.map((page) => ({
    title: page.title,
    under: page.pages.map((sub) => sub.title),
  }));
  if (all.length <= max) return { lines: all, more: 0 };
  return { lines: all.slice(0, max - 1), more: all.length - (max - 1) };
}
