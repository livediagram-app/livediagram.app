'use client';

// The meta row's two pills (docs/specs/030-knowledgebase/verification.md "Made by a person or an agent"): who made
// the page and who changed it last, a person or an agent, each with a hover card naming them. Neutral grey, never
// the accent or a state colour, so neither reads as a warning; a page with no stamps shows neither.
import type { PageAuthorStamp } from '@liveknowledge/api-schema';
import { HoverCard } from '@liveknowledge/ui';
import { makerPills } from '@/lib/knowledge/page-makers';
import { MakerAgentIcon, MakerPersonIcon } from './knowledge-icons';

// slate-700 on slate-100 and slate-200 on slate-800 both hold well over 4.5:1.
const PILL =
  'inline-flex h-5 shrink-0 cursor-default items-center gap-1 rounded-full bg-slate-100 px-2 text-[12px] font-medium leading-none text-slate-700 dark:bg-slate-800 dark:text-slate-200';

export type PageMakers = { created?: PageAuthorStamp; updated?: PageAuthorStamp };

export function PageMakersBadges({
  makers,
  nameOf,
  now,
}: {
  makers: PageMakers;
  nameOf: (id: string | undefined) => string | undefined;
  now: number;
}) {
  const pills = makerPills(makers, nameOf, now);
  if (pills.length === 0) return null;
  return (
    <span data-page-makers="" className="inline-flex items-center gap-1">
      {pills.map((words) => {
        return (
          <HoverCard key={words.key} title={words.label} description={words.description}>
            <span
              // Focusable, so the keyboard reaches its card as a pointer does.
              tabIndex={0}
              data-page-maker={words.key}
              data-maker-kind={words.kind}
              className={`${PILL} focus-visible:outline-2 focus-visible:outline-brand-600`}
            >
              <span aria-hidden className="text-slate-500 dark:text-slate-400">
                {words.kind === 'ai' ? <MakerAgentIcon /> : <MakerPersonIcon />}
              </span>
              {words.label}
            </span>
          </HoverCard>
        );
      })}
    </span>
  );
}
