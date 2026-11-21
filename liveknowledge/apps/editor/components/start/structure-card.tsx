'use client';

// A knowledgebase structure as a start's card (StartCard): the structure itself in place of a picture, an outline of
// its page tree two levels deep (structureOutline; a phone's small tile keeps the top level only), with its page
// count beside its name. Blank Knowledgebase and
// Describe to Set Up draw their own small outline: an empty page, and a sparkle over pages to come.
import type { ReactNode } from 'react';
import { setupStructure, structureOutline, structurePageCount } from '@liveknowledge/knowledge';
import type { StartPanelCard } from '@liveworkspace/workbench/components/start/StartCard';
import { BLANK_KNOWLEDGEBASE, DESCRIBE_TO_SET_UP } from './start-structure-items';
import { SetupSparkleIcon } from '@/components/setup/setup-icons';

const plural = (n: number) => `${n} ${n === 1 ? 'Page' : 'Pages'}`;

// The outline's frame: a quiet sheet of rows, like the sidebar's tree in miniature. Real text in the theme's own
// colours, not a preview-art-tile (that tile inverts in dark, which turned this ink dark on a dark plate).
function Outline({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-full w-full flex-col justify-center overflow-hidden rounded-lg bg-slate-50 px-4 py-2 text-left text-[11px] leading-[14px] text-slate-600 max-sm:px-1.5 max-sm:py-1 max-sm:text-[8px] max-sm:leading-[11px] dark:bg-slate-800/60 dark:text-slate-300">
      {children}
    </span>
  );
}

const Row = ({ title, under }: { title: string; under?: readonly string[] }) => (
  <span className="block truncate">
    <span className="font-medium text-slate-800 dark:text-slate-100">{title}</span>
    {under && under.length > 0 ? (
      <span className="text-slate-500 max-sm:hidden dark:text-slate-400">: {under.join(', ')}</span>
    ) : null}
  </span>
);

export function StructureOutline({ id }: { id: string }) {
  const structure = setupStructure(id);
  if (!structure) return null;
  const { lines, more } = structureOutline(structure);
  return (
    <Outline>
      {lines.map((line) => (
        <Row key={line.title} title={line.title} under={line.under} />
      ))}
      {more > 0 ? (
        <span className="text-slate-500 dark:text-slate-400">and {more} More</span>
      ) : null}
    </Outline>
  );
}

export function structureCard(id: string): StartPanelCard {
  if (id === BLANK_KNOWLEDGEBASE)
    return {
      id,
      name: 'Blank Knowledgebase',
      line: 'One empty page, Start Here, to shape the knowledgebase yourself.',
      tag: plural(1),
      picture: (
        <Outline>
          <Row title="Start Here" />
        </Outline>
      ),
    };
  if (id === DESCRIBE_TO_SET_UP)
    return {
      id,
      name: 'Describe to Set Up',
      line: 'Say what the knowledgebase is for, and AI suggests its pages for you to review.',
      picture: (
        <Outline>
          <span className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-100">
            <SetupSparkleIcon aria-hidden />
            Your Description
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Suggested Pages, Ready to Review
          </span>
        </Outline>
      ),
    };
  const structure = setupStructure(id)!;
  return {
    id,
    name: structure.name,
    line: structure.line,
    tag: plural(structurePageCount(structure)),
    picture: <StructureOutline id={id} />,
  };
}
