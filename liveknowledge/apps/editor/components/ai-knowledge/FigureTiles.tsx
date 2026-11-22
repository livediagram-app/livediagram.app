'use client';

// AI Knowledge's figures band (docs/specs/030-knowledgebase/ai-knowledge.md "The view, as built"): six tiles, each
// a button named by its words and its figure. Three filter Needs Attention; the others bring their card into view.
// A figure that asks for someone carries a small amber mark.
import { useId, type ReactNode } from 'react';
import type { KnowledgeReadsDay } from '@liveknowledge/api-schema';
import { HoverCard } from '@liveknowledge/ui';
import type { AttentionFilter, DashboardFigures } from '@/lib/knowledge-ask/dashboard-figures';
import {
  AgentIcon,
  ConflictIcon,
  HealthIcon,
  QuestionIcon,
  ReadsIcon,
  SuggestionIcon,
} from './ai-knowledge-icons';
import { readsSparkLabel } from '@/lib/knowledge-ask/dashboard-figures';
import { AGENT_BG, PEOPLE_BG, ReadsSparkline } from './ReadsSparkline';

/** Where a tile leads: a card brought into view, or a Needs Attention filter. */
export type TileTarget = { card: 'reads' | 'agents' | 'health' } | { filter: AttentionFilter };

const TILE =
  'group relative flex min-h-[112px] w-full min-w-0 cursor-pointer flex-col rounded-2xl border bg-white p-3.5 text-left transition-[border-color,box-shadow] duration-micro hover:border-slate-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-900 dark:hover:border-slate-600';
const TILE_REST = 'border-slate-200 dark:border-slate-800';
const TILE_ON = 'border-brand-600 ring-1 ring-brand-600 dark:border-brand-400 dark:ring-brand-400';
const count = (n: number) => n.toLocaleString('en');

function Tile({
  icon,
  label,
  figure,
  line,
  hint,
  attention = false,
  pressed,
  onPress,
  children,
  spoken,
}: {
  icon: ReactNode;
  label: string;
  figure: string;
  line: ReactNode;
  // What pressing it does, in its hover card.
  hint: string;
  attention?: boolean;
  // Set on a tile that filters: whether its filter is on.
  pressed?: boolean;
  onPress: () => void;
  // Under the line: the Reads tile's sparkline, said with the line by `spoken`.
  children?: ReactNode;
  spoken?: string;
}) {
  const about = useId();
  return (
    <HoverCard title={label} description={hint} block>
      <button
        type="button"
        onClick={onPress}
        aria-pressed={pressed}
        // Its name is its words and its figure; the line under them (and a sparkline's label) describes it.
        aria-label={`${label}: ${figure}${attention ? ', needs attention' : ''}`}
        aria-describedby={about}
        data-figure-tile={label}
        className={`${TILE} ${pressed ? TILE_ON : TILE_REST}`}
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span aria-hidden className="text-slate-500 dark:text-slate-400 [&_svg]:size-3.5">
            {icon}
          </span>
          <span className="min-w-0 leading-4">{label}</span>
          {attention ? (
            <span
              aria-hidden
              data-attention=""
              className="ml-auto h-2 w-2 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-500/25"
            />
          ) : null}
        </span>
        <span className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
          {figure}
        </span>
        <span
          id={about}
          className="mt-auto min-w-0 pt-1 text-xs leading-5 text-slate-600 dark:text-slate-400"
        >
          {line}
          {spoken ? <span className="sr-only">. {spoken}</span> : null}
        </span>
        {children}
      </button>
    </HoverCard>
  );
}

export function FigureTiles({
  figures,
  days,
  filter,
  onGo,
}: {
  figures: DashboardFigures;
  days: readonly KnowledgeReadsDay[];
  filter: AttentionFilter;
  onGo: (target: TileTarget) => void;
}) {
  const toggle = (to: AttentionFilter) => onGo({ filter: filter === to ? 'all' : to });
  const { readsWeek } = figures;
  return (
    <div
      role="group"
      aria-label="AI Knowledge at a glance"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
    >
      <Tile
        icon={<ReadsIcon />}
        label="Reads This Week"
        figure={count(readsWeek.total)}
        hint="Pages opened by people and read by agents in the last 7 days. Shows Most Read."
        onPress={() => onGo({ card: 'reads' })}
        spoken={readsSparkLabel(days)}
        line={
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${PEOPLE_BG}`} />
              {count(readsWeek.people)} people
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${AGENT_BG}`} />
              {count(readsWeek.agents)} agents
            </span>
          </span>
        }
      >
        <span aria-hidden className="mt-2 block">
          <ReadsSparkline days={days} />
        </span>
      </Tile>
      <Tile
        icon={<AgentIcon />}
        label="Connected Agents"
        figure={count(figures.agents)}
        hint="Agents that read or wrote here in the last 30 days. Shows their cards."
        onPress={() => onGo({ card: 'agents' })}
        line={
          figures.agents === 0
            ? 'None connected yet'
            : figures.writers === 0
              ? 'All read and suggest'
              : `${count(figures.writers)} may write`
        }
      />
      <Tile
        icon={<QuestionIcon />}
        label="Open Questions"
        figure={count(figures.questions)}
        hint="Questions no page could answer. Shows them under Needs Attention."
        attention={figures.questions > 0}
        pressed={filter === 'questions'}
        onPress={() => toggle('questions')}
        line={
          figures.questions === 0
            ? 'Every question answered'
            : `Asked ${figures.asks === 1 ? 'once' : `${count(figures.asks)} times`}`
        }
      />
      <Tile
        icon={<ConflictIcon />}
        label="Pages That Disagree"
        figure={count(figures.conflicts)}
        hint="Pairs of pages that state opposite facts. Shows them under Needs Attention."
        attention={figures.conflicts > 0}
        pressed={filter === 'conflicts'}
        onPress={() => toggle('conflicts')}
        line={figures.conflicts === 0 ? 'None found' : 'To settle'}
      />
      <Tile
        icon={<SuggestionIcon />}
        label="Suggested Edits"
        figure={count(figures.suggestions)}
        hint="Agents' edits waiting to be accepted or dismissed. Shows them under Needs Attention."
        attention={figures.suggestions > 0}
        pressed={filter === 'suggestions'}
        onPress={() => toggle('suggestions')}
        line={figures.suggestions === 0 ? 'None waiting' : 'Waiting for review'}
      />
      <Tile
        icon={<HealthIcon />}
        label="Verified"
        figure={figures.verifiedShare === null ? 'None' : `${figures.verifiedShare}%`}
        hint="The share of pages someone vouches for. Shows Knowledge Health."
        attention={figures.reviewDue > 0}
        onPress={() => onGo({ card: 'health' })}
        line={
          (figures.verifiedShare === null
            ? 'No pages to verify'
            : figures.reviewDue > 0
              ? `${count(figures.reviewDue)} due for review`
              : figures.neverVerified > 0
                ? `${count(figures.neverVerified)} never verified`
                : 'Every page verified') +
          // The average Health Score beside the verified share (ai-knowledge.md "The figures band").
          (figures.averageHealth === undefined ? '' : `, health ${figures.averageHealth}`)
        }
      />
    </div>
  );
}
