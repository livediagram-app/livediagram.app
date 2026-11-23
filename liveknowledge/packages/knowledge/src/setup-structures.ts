// The knowledgebase structures (docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"): liveknowledge's
// templates, offered on a new knowledgebase's start, in the landing page's template gallery and on Home. Each is the
// whole shape of a knowledgebase, a tree of titled pages with a line on what belongs on each and the headings its
// writing would sit under: structure, never sample writing. A structure becomes a SetupSuggestion through the parser
// a model's reply goes through (parseSetupSuggestion), so a structure picked here and one the AI proposes are one
// shape, created by one path, within the same bounds.
import { parseSetupSuggestion, type SetupSuggestion } from './setup-suggestion';
import { COMMUNITY_STRUCTURES } from './structures/community';
import { CUSTOMER_STRUCTURES } from './structures/customers';
import { EDUCATION_STRUCTURES } from './structures/education';
import { ENGINEERING_STRUCTURES } from './structures/engineering';
import { OPERATIONS_STRUCTURES } from './structures/operations';
import { PERSONAL_STRUCTURES } from './structures/personal';
import { PRODUCT_STRUCTURES } from './structures/product';
import type { SetupStructure, StructureGroup, StructurePage } from './structures/shape';
import { styleStructure } from './structures/looks';
import { TEAM_STRUCTURES } from './structures/team';

export type { SetupStructure, StructureGroup, StructurePage } from './structures/shape';

// The groups in the start's order: work for a company first, a person's own last. Each holds four structures, a
// gallery shelf's four-across row.
export const STRUCTURE_GROUPS: readonly { id: StructureGroup; name: string; line: string }[] = [
  {
    id: 'team',
    name: 'Company',
    line: 'How the company and its teams work, and how someone new finds their feet.',
  },
  {
    id: 'engineering',
    name: 'Engineering',
    line: 'How the systems are built, shipped and kept running.',
  },
  {
    id: 'product',
    name: 'Product',
    line: 'What the product does, what is learned about its users and how projects run.',
  },
  {
    id: 'support',
    name: 'Customers',
    line: 'How customers are reached, won, helped and kept.',
  },
  {
    id: 'operations',
    name: 'Operations',
    line: 'The business underneath: systems and security, money and contracts, data and decisions.',
  },
  {
    id: 'community',
    name: 'Community',
    line: 'Work done with people outside the team: clients, contributors, members and guests.',
  },
  {
    id: 'education',
    name: 'Education',
    line: 'Courses, classes and training, for whoever teaches and whoever learns.',
  },
  {
    id: 'personal',
    name: 'Personal',
    line: 'A knowledgebase of your own: notes, plans and the things worth keeping.',
  },
];

/** Every structure, group by group in the start's order. */
export const SETUP_STRUCTURES: readonly SetupStructure[] = [
  ...TEAM_STRUCTURES,
  ...ENGINEERING_STRUCTURES,
  ...PRODUCT_STRUCTURES,
  ...CUSTOMER_STRUCTURES,
  ...OPERATIONS_STRUCTURES,
  ...COMMUNITY_STRUCTURES,
  ...EDUCATION_STRUCTURES,
  ...PERSONAL_STRUCTURES,
].map(styleStructure);

// The outline as a model's reply has it: every page an object with its own id and its parent's.
function replyOf(structure: SetupStructure): string {
  const pages: object[] = [];
  const walk = (list: readonly StructurePage[], parent: string | null) => {
    for (const page of list) {
      const id = `s${pages.length + 1}`;
      pages.push({
        id,
        parent,
        title: page.title,
        summary: page.summary,
        headings: page.headings,
        icon: page.icon,
        cover: page.cover,
      });
      walk(page.pages, id);
    }
  };
  walk(structure.pages, null);
  return JSON.stringify({ name: structure.name, pages });
}

/** The structure as Describe to Set Up's suggestion: read by the parser a model's reply goes through. */
export function structureSuggestion(structure: SetupStructure): SetupSuggestion {
  // Every structure here reads whole (setup-structures.test.ts); the fallback is the empty knowledgebase it starts as.
  return parseSetupSuggestion(replyOf(structure)) ?? { name: structure.name, pages: [] };
}

/** A structure by its id. */
export const setupStructure = (id: string): SetupStructure | undefined =>
  SETUP_STRUCTURES.find((s) => s.id === id);

// Every page title in a structure, at every level, in tree order.
const titlesOf = (pages: readonly StructurePage[]): string[] =>
  pages.flatMap((page) => [page.title, ...titlesOf(page.pages)]);

/** Every page title a structure makes, at every level: what a search of the structures reads beside its name. */
export const structurePageTitles = (structure: SetupStructure): string[] =>
  titlesOf(structure.pages);

/** How many pages a structure makes. */
export const structurePageCount = (structure: SetupStructure): number =>
  titlesOf(structure.pages).length;

/** A structure's outline, two levels: each top page, with its subpages' titles after it. At most `max` lines: past
 *  that, one line fewer and the rest counted on the last. The editor's start and the landing gallery draw it. */
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
