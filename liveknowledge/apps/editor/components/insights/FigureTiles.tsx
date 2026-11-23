'use client';

// Insights' figures band (docs/specs/030-knowledgebase/insights.md "The view, as built"): six tiles, each
// a button named by its words and its figure. Three filter Needs Attention; the others bring their card into view.
// A figure that asks for someone carries a small amber mark.
import { useId, useState, type ReactNode } from 'react';
import type { KnowledgeOverviewResponse } from '@liveknowledge/api-schema';
import { HoverCard } from '@liveknowledge/ui';
import type { AttentionFilter, DashboardFigures } from '@/lib/knowledge-ask/dashboard-figures';
import {
  AgentIcon,
  ConflictIcon,
  HealthIcon,
  QuestionIcon,
  ReadsIcon,
  SuggestionIcon,
} from './insights-icons';
import { readsSparkLabel } from '@/lib/knowledge-ask/dashboard-figures';
import {
  agentShares,
  agentsCaption,
  conflictsLine,
  conflictsSpoken,
  oldestConflict,
  questionBars,
  questionsLine,
  questionsSpoken,
  suggestionsLine,
  suggestionsSpoken,
  verifiedCaption,
  verifiedParts,
  waitingDots,
} from '@/lib/knowledge-ask/tile-visuals';
import { AGENT_BG, PEOPLE_BG, ReadsSparkline } from './ReadsSparkline';
import {
  AgentShareBar,
  ConflictPair,
  QuestionBars,
  VerifiedBar,
  WaitingTrack,
} from './TileVisuals';

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
  // Under the line: the tile's picture (the Reads sparkline, or one of TileVisuals), said with the line by `spoken`.
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
  overview,
  filter,
  onGo,
}: {
  figures: DashboardFigures;
  overview: KnowledgeOverviewResponse;
  filter: AttentionFilter;
  onGo: (target: TileTarget) => void;
}) {
  const toggle = (to: AttentionFilter) => onGo({ filter: filter === to ? 'all' : to });
  const { readsWeek } = figures;
  const days = overview.reads.days;
  // Read once when the band first draws: the waits and ages are in whole days, so a re-render needs no new clock.
  const [now] = useState(() => Date.now());
  const shares = agentShares(overview.agents);
  const bars = questionBars(overview.questions);
  const oldest = oldestConflict(overview.conflicts);
  const dots = waitingDots(overview.suggestions, now);
  const parts = verifiedParts(overview.health);
  const agentsWords = agentsCaption(overview.agents, shares);
  const partsWords = verifiedCaption(parts);
  return (
    <div
      role="group"
      aria-label="Insights at a glance"
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
              {count(readsWeek.people)} by people
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${AGENT_BG}`} />
              {count(readsWeek.agents)} by agents
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
        spoken={`${agentsWords}.`}
      >
        <AgentShareBar shares={shares} caption={agentsWords} />
      </Tile>
      <Tile
        icon={<QuestionIcon />}
        label="Open Questions"
        figure={count(figures.questions)}
        hint="Questions no page could answer. Shows them under Needs Attention."
        attention={figures.questions > 0}
        pressed={filter === 'questions'}
        onPress={() => toggle('questions')}
        line={questionsLine(overview.questions)}
        spoken={questionsSpoken(bars)}
      >
        <QuestionBars bars={bars} />
      </Tile>
      <Tile
        icon={<ConflictIcon />}
        label="Pages That Disagree"
        figure={count(figures.conflicts)}
        hint="Pairs of pages that state opposite facts. Shows them under Needs Attention."
        attention={figures.conflicts > 0}
        pressed={filter === 'conflicts'}
        onPress={() => toggle('conflicts')}
        line={conflictsLine(overview.conflicts, now)}
        spoken={conflictsSpoken(overview.conflicts)}
      >
        <ConflictPair oldest={oldest} />
      </Tile>
      <Tile
        icon={<SuggestionIcon />}
        label="Suggested Edits"
        figure={count(figures.suggestions)}
        hint="Agents' edits waiting to be accepted or dismissed. Shows them under Needs Attention."
        attention={figures.suggestions > 0}
        pressed={filter === 'suggestions'}
        onPress={() => toggle('suggestions')}
        line={suggestionsLine(overview.suggestions, now)}
        spoken={suggestionsSpoken(dots)}
      >
        <WaitingTrack dots={dots} />
      </Tile>
      {figures.verificationOn ? (
        <Tile
          icon={<HealthIcon />}
          label="Verified"
          figure={figures.verifiedShare === null ? 'None' : `${figures.verifiedShare}%`}
          hint="The share of pages someone vouches for. The bar: verified, due for review, never verified. Shows Knowledge Health."
          attention={figures.reviewDue > 0}
          onPress={() => onGo({ card: 'health' })}
          line={
            // The average Health Score under the verified share (insights.md "Every tile draws a picture").
            figures.verifiedShare === null
              ? 'No pages to verify'
              : figures.averageHealth === undefined
                ? figures.reviewDue > 0
                  ? `${count(figures.reviewDue)} due for review`
                  : 'Every page verified'
                : `Average health ${figures.averageHealth}`
          }
          spoken={`${partsWords}.`}
        >
          <VerifiedBar parts={parts} />
        </Tile>
      ) : (
        // Verification off (a Review Period of Never): the average Health Score in Verified's place.
        <Tile
          icon={<HealthIcon />}
          label="Average Health"
          figure={figures.averageHealth === undefined ? 'None' : String(figures.averageHealth)}
          hint="The average Health Score of every page. Shows Knowledge Health."
          onPress={() => onGo({ card: 'health' })}
          line={
            figures.pages === 0
              ? 'No pages yet'
              : `Across ${count(figures.pages)} ${figures.pages === 1 ? 'page' : 'pages'}`
          }
        />
      )}
    </div>
  );
}
