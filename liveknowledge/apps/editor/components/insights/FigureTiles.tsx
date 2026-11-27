'use client';

// Needs Attention's figure tiles (docs/specs/030-knowledgebase/insights.md "The figure tiles"): three, each a
// button named by its words and its figure, that filter the card under them. A figure that asks for someone carries
// a small amber mark.
import { useId, useState, type ReactNode } from 'react';
import type { KnowledgeOverviewResponse } from '@liveknowledge/api-schema';
import { HoverCard } from '@liveknowledge/ui';
import type { AttentionFilter } from '@/lib/knowledge-ask/dashboard-figures';
import { ConflictIcon, QuestionIcon, SuggestionIcon } from './insights-icons';
import {
  conflictsLine,
  conflictsSpoken,
  oldestConflict,
  questionBars,
  questionsLine,
  questionsSpoken,
  suggestionsLine,
  suggestionsSpoken,
  waitingDots,
} from '@/lib/knowledge-ask/tile-visuals';
import { ConflictPair, QuestionBars, WaitingTrack } from './TileVisuals';

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

export function AttentionTiles({
  overview,
  filter,
  onFilter,
}: {
  overview: KnowledgeOverviewResponse;
  filter: AttentionFilter;
  // The filter to show: the tile's own, or All when it is on already.
  onFilter: (filter: AttentionFilter) => void;
}) {
  const toggle = (to: AttentionFilter) => onFilter(filter === to ? 'all' : to);
  // Read once when the band first draws: the waits and ages are in whole days, so a re-render needs no new clock.
  const [now] = useState(() => Date.now());
  const bars = questionBars(overview.questions);
  const oldest = oldestConflict(overview.conflicts);
  const dots = waitingDots(overview.suggestions, now);
  const { questions, conflicts, suggestions } = overview;
  return (
    <div
      role="group"
      aria-label="Needs Attention at a glance"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      <Tile
        icon={<QuestionIcon />}
        label="Open Questions"
        figure={count(questions.length)}
        hint="Questions no page could answer. Shows only those below."
        attention={questions.length > 0}
        pressed={filter === 'questions'}
        onPress={() => toggle('questions')}
        line={questionsLine(questions)}
        spoken={questionsSpoken(bars)}
      >
        <QuestionBars bars={bars} />
      </Tile>
      <Tile
        icon={<ConflictIcon />}
        label="Pages That Disagree"
        figure={count(conflicts.length)}
        hint="Pairs of pages that state opposite facts. Shows only those below."
        attention={conflicts.length > 0}
        pressed={filter === 'conflicts'}
        onPress={() => toggle('conflicts')}
        line={conflictsLine(conflicts, now)}
        spoken={conflictsSpoken(conflicts)}
      >
        <ConflictPair oldest={oldest} />
      </Tile>
      <Tile
        icon={<SuggestionIcon />}
        label="Suggested Edits"
        figure={count(suggestions.length)}
        hint="Agents' edits waiting to be accepted or dismissed. Shows only those below."
        attention={suggestions.length > 0}
        pressed={filter === 'suggestions'}
        onPress={() => toggle('suggestions')}
        line={suggestionsLine(suggestions, now)}
        spoken={suggestionsSpoken(dots)}
      >
        <WaitingTrack dots={dots} />
      </Tile>
    </div>
  );
}
