// The shape of a knowledgebase structure (setup-structures.ts, docs/specs/030-knowledgebase/describe-to-set-up.md
// "The start screen"), shared by every group's module under structures/ and the entry that joins them.

/** One page of a structure's outline, with its subpages. */
export type StructurePage = {
  title: string;
  summary: string;
  headings: readonly string[];
  pages: readonly StructurePage[];
};

/** Who a structure is for: the start's rail group it sits in. */
export type StructureGroup =
  | 'team'
  | 'engineering'
  | 'product'
  | 'support'
  | 'operations'
  | 'community'
  | 'education'
  | 'personal';

export type SetupStructure = {
  id: string;
  name: string;
  line: string;
  group: StructureGroup;
  pages: readonly StructurePage[];
};

/** A page of an outline: its title, its one line, the headings its writing sits under and its subpages. */
export const p = (
  title: string,
  summary: string,
  headings: readonly string[] = [],
  pages: readonly StructurePage[] = [],
): StructurePage => ({ title, summary, headings, pages });
