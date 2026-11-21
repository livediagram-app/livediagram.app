'use client';

// A knowledgebase structure as a start's card (StartCard): its picture is the knowledgebase it makes
// (StructureArt, @liveknowledge/ui; docs/specs/030-knowledgebase/describe-to-set-up.md "A card's picture"), a
// miniature window in its group's colour with its real top pages and its emblem, and its page count beside its
// name. Blank Knowledgebase and Describe to Set Up draw the same window: an empty Start Here, and pages to come.
import { setupStructure, structurePageCount } from '@liveknowledge/knowledge';
import { StructureArt } from '@liveknowledge/ui';
import type { StartPanelCard } from '@liveworkspace/workbench/components/start/StartCard';
import { BLANK_KNOWLEDGEBASE, DESCRIBE_TO_SET_UP } from './start-structure-items';

const plural = (n: number) => `${n} ${n === 1 ? 'Page' : 'Pages'}`;

export function StructurePicture({ id }: { id: string }) {
  const structure = setupStructure(id);
  if (!structure) return null;
  return (
    <StructureArt
      kind="structure"
      id={structure.id}
      group={structure.group}
      pages={structure.pages}
    />
  );
}

export function structureCard(id: string): StartPanelCard {
  if (id === BLANK_KNOWLEDGEBASE)
    return {
      id,
      name: 'Blank Knowledgebase',
      line: 'One empty page, Start Here, to shape the knowledgebase yourself.',
      tag: plural(1),
      picture: <StructureArt kind="blank" />,
    };
  if (id === DESCRIBE_TO_SET_UP)
    return {
      id,
      name: 'Describe to Set Up',
      line: 'Say what the knowledgebase is for, and AI suggests its pages for you to review.',
      picture: <StructureArt kind="describe" />,
    };
  const structure = setupStructure(id)!;
  return {
    id,
    name: structure.name,
    line: structure.line,
    tag: plural(structurePageCount(structure)),
    picture: <StructurePicture id={id} />,
  };
}
