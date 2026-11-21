// What the knowledgebase's start screen offers (docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen"): shapes of a whole knowledgebase. Start (Blank Knowledgebase, and Describe to Set Up where it is offered),
// then the structures by who they are for, and the search across them. Pure: the panel draws what these return.
import {
  SETUP_STRUCTURES,
  STRUCTURE_GROUPS,
  setupStructure,
  structurePageTitles,
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

// What a search reads of each card: its name and line, and a structure's page titles.
const BLANK_TEXT = 'Blank Knowledgebase empty start from nothing';
const DESCRIBE_TEXT = 'Describe to Set Up AI describe suggest a structure';
const textOf = (id: string): string => {
  if (id === BLANK_KNOWLEDGEBASE) return BLANK_TEXT;
  if (id === DESCRIBE_TO_SET_UP) return DESCRIBE_TEXT;
  const s = setupStructure(id)!;
  return [s.name, s.line, ...structurePageTitles(s)].join(' ');
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
