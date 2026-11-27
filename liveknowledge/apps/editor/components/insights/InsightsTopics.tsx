'use client';

// The Insights dashboard (docs/specs/030-knowledgebase/insights.md "The dashboard"): a tile a topic, each saying
// where to look in it and opening its page. Every figure is from the one overview read.
import type { ReactNode } from 'react';
import type { KnowledgeOverviewResponse } from '@liveknowledge/api-schema';
import { HEALTH_HEALTHY_MIN, NOT_READ_DAYS } from '@liveknowledge/knowledge';
import { HoverCard } from '@liveknowledge/ui';
import { HealthChip } from '@/components/knowledge/HealthChip';
import {
  dashboardFigures,
  readsSparkLabel,
  type AttentionFilter,
} from '@/lib/knowledge-ask/dashboard-figures';
import { INSIGHTS_TOPICS, type InsightsTopic } from '@/lib/knowledge-ask/insights-topic';
import { budgetText } from '@/lib/knowledge-ask/overview-words';
import {
  agentShares,
  agentsCaption,
  verifiedCaption,
  verifiedParts,
} from '@/lib/knowledge-ask/tile-visuals';
import {
  attentionLine,
  attentionPreview,
  notReadText,
  requiredText,
} from '@/lib/knowledge-ask/topic-summaries';
import {
  AgentIcon,
  AttentionIcon,
  ConflictSmallIcon,
  ContextIcon,
  HealthIcon,
  MostReadIcon,
  QuestionSmallIcon,
  ReadsIcon,
  SuggestionSmallIcon,
} from './insights-icons';
import { ReadsSparkline, ReadsSplit } from './ReadsSparkline';
import { AgentShareBar, VerifiedBar } from './TileVisuals';
import { ABOVE_COVER, PreviewNote, PreviewRow, TopicPreview, TopicTile } from './TopicTile';

const count = (n: number) => n.toLocaleString('en');
const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`;

const ICON: Record<InsightsTopic, ReactNode> = {
  attention: <AttentionIcon />,
  health: <HealthIcon />,
  reads: <ReadsIcon />,
  agents: <AgentIcon />,
};

const KIND_ICON = {
  conflict: <ConflictSmallIcon />,
  suggestion: <SuggestionSmallIcon />,
  question: <QuestionSmallIcon />,
} as const;

const label = (topic: InsightsTopic) => INSIGHTS_TOPICS.find((t) => t.topic === topic)!.label;

const COUNT_BUTTON =
  'flex w-full min-w-0 cursor-pointer flex-col items-start rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors duration-micro hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-slate-600 dark:hover:bg-slate-800';

/** One of Needs Attention's three counts: opens the page at its filter. */
function AttentionCount({
  name,
  figure,
  hint,
  onPress,
}: {
  name: string;
  figure: number;
  hint: string;
  onPress: () => void;
}) {
  return (
    <HoverCard title={name} description={hint} block className={ABOVE_COVER}>
      <button
        type="button"
        onClick={onPress}
        aria-label={`${name}: ${count(figure)}`}
        data-attention-count={name}
        className={COUNT_BUTTON}
      >
        <span className="text-lg font-semibold tabular-nums leading-6 text-slate-900 dark:text-white">
          {count(figure)}
        </span>
        <span className="text-xs leading-4 text-slate-600 dark:text-slate-300">{name}</span>
      </button>
    </HoverCard>
  );
}

export function InsightsTopics({
  overview,
  onOpen,
}: {
  overview: KnowledgeOverviewResponse;
  onOpen: (topic: InsightsTopic, show?: AttentionFilter) => void;
}) {
  const figures = dashboardFigures(overview);
  const waiting = figures.questions + figures.conflicts + figures.suggestions;
  const preview = attentionPreview(overview);
  const parts = verifiedParts(overview.health);
  const shares = agentShares(overview.agents);
  const agentsWords = agentsCaption(overview.agents, shares);
  const notRead = notReadText(overview.notRead, overview.notRead?.days ?? NOT_READ_DAYS);
  const required = requiredText(overview.requiredReading);
  const lowest = overview.lowHealth?.slice(0, 3);
  const topReaders = [...overview.agents]
    .filter((agent) => agent.readsThisWeek > 0)
    .sort((a, b) => b.readsThisWeek - a.readsThisWeek)
    .slice(0, 2);
  const { context } = overview;
  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-2" data-insights-topics="">
      <TopicTile
        topic="attention"
        label={label('attention')}
        icon={ICON.attention}
        figure={count(waiting)}
        line={
          waiting === 0 ? 'Nothing waiting for anyone' : 'waiting for someone, most urgent first'
        }
        attention={waiting > 0}
        onOpen={() => onOpen('attention')}
      >
        <div className="mt-4 grid grid-cols-3 gap-2">
          <AttentionCount
            name="Questions"
            figure={figures.questions}
            hint="Questions no page could answer. Opens Needs Attention at them."
            onPress={() => onOpen('attention', 'questions')}
          />
          <AttentionCount
            name="Disagreements"
            figure={figures.conflicts}
            hint="Pairs of pages that state opposite facts. Opens Needs Attention at them."
            onPress={() => onOpen('attention', 'conflicts')}
          />
          <AttentionCount
            name="Suggested Edits"
            figure={figures.suggestions}
            hint="Agents' edits waiting to be accepted or dismissed. Opens Needs Attention at them."
            onPress={() => onOpen('attention', 'suggestions')}
          />
        </div>
        {preview.rows.length === 0 ? (
          <PreviewNote>
            Questions nobody could answer, pages that disagree and edits agents suggest land here.
          </PreviewNote>
        ) : (
          <>
            <TopicPreview label="Most urgent">
              {preview.rows.map((item) => (
                <PreviewRow key={item.id} icon={KIND_ICON[item.kind]} text={attentionLine(item)} />
              ))}
            </TopicPreview>
            {preview.more > 0 ? <PreviewNote>{count(preview.more)} more</PreviewNote> : null}
          </>
        )}
      </TopicTile>

      {figures.verificationOn ? (
        <TopicTile
          topic="health"
          label={label('health')}
          icon={ICON.health}
          figure={figures.verifiedShare === null ? 'None' : `${figures.verifiedShare}%`}
          line={
            figures.pages === 0
              ? 'No pages yet'
              : `of ${plural(figures.pages, 'page', 'pages')} verified${
                  figures.averageHealth === undefined
                    ? ''
                    : `, average health ${figures.averageHealth}`
                }`
          }
          spoken={`${verifiedCaption(parts)}.`}
          attention={figures.reviewDue > 0}
          onOpen={() => onOpen('health')}
        >
          <VerifiedBar parts={parts} />
          <HealthPreview lowest={lowest} notRead={notRead} />
        </TopicTile>
      ) : (
        // Verification off (a Review Period of Never): the average Health Score leads, with no share or bar.
        <TopicTile
          topic="health"
          label={label('health')}
          icon={ICON.health}
          figure={figures.averageHealth === undefined ? 'None' : String(figures.averageHealth)}
          line={
            figures.pages === 0
              ? 'No pages yet'
              : `average health across ${plural(figures.pages, 'page', 'pages')}`
          }
          onOpen={() => onOpen('health')}
        >
          <HealthPreview lowest={lowest} notRead={notRead} />
        </TopicTile>
      )}

      <TopicTile
        topic="reads"
        label={label('reads')}
        icon={ICON.reads}
        figure={count(figures.readsWeek.total)}
        line="reads this week"
        spoken={readsSparkLabel(overview.reads.days)}
        onOpen={() => onOpen('reads')}
      >
        <span aria-hidden className="mt-3 block">
          <ReadsSparkline days={overview.reads.days} />
        </span>
        <span className="mt-1 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          <ReadsSplit people={figures.readsWeek.people} agents={figures.readsWeek.agents} />
        </span>
        {overview.reads.mostRead.length === 0 ? (
          <PreviewNote>No reads yet. Opening a page counts a read.</PreviewNote>
        ) : (
          <TopicPreview label="Read most this week">
            {overview.reads.mostRead.slice(0, 3).map((page) => (
              <PreviewRow
                key={page.tab}
                icon={<MostReadIcon />}
                text={page.title || 'Untitled Page'}
                end={
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {plural(page.people + page.agents, 'read', 'reads')}
                  </span>
                }
              />
            ))}
          </TopicPreview>
        )}
        {required ? <PreviewNote>{required}</PreviewNote> : null}
      </TopicTile>

      <TopicTile
        topic="agents"
        label={label('agents')}
        icon={ICON.agents}
        figure={count(figures.agents)}
        line={
          figures.agents === 0
            ? 'No agents connected yet'
            : `connected in 30 days, ${
                figures.writers === 0
                  ? 'all read and suggest'
                  : `${count(figures.writers)} may write`
              }`
        }
        spoken={`${agentsWords}.`}
        onOpen={() => onOpen('agents')}
      >
        <AgentShareBar shares={shares} caption={agentsWords} />
        <TopicPreview label="Agents and context">
          {topReaders.map((agent) => (
            <PreviewRow
              key={agent.id}
              icon={<AgentIcon />}
              text={agent.name}
              end={
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {plural(agent.readsThisWeek, 'read', 'reads')}
                </span>
              }
            />
          ))}
          <PreviewRow
            icon={<ContextIcon />}
            text={`Always in Context: ${plural(context.pages.length, 'page', 'pages')}`}
            end={
              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {budgetText(context.used, context.budget)}
              </span>
            }
          />
        </TopicPreview>
      </TopicTile>
    </div>
  );
}

/** Page Health's rows to look at: the lowest-health pages, then how many nobody read. */
function HealthPreview({
  lowest,
  notRead,
}: {
  lowest: KnowledgeOverviewResponse['lowHealth'];
  notRead: string | null;
}) {
  return (
    <>
      {lowest && lowest.length > 0 ? (
        <TopicPreview label="Lowest health">
          {lowest.map((page) => (
            <PreviewRow
              key={page.tab}
              text={page.title || 'Untitled Page'}
              end={<HealthChip score={page.score} label={page.label} />}
            />
          ))}
        </TopicPreview>
      ) : lowest ? (
        <PreviewNote>Every page scores {HEALTH_HEALTHY_MIN} or more.</PreviewNote>
      ) : null}
      {notRead ? <PreviewNote>{notRead}</PreviewNote> : null}
    </>
  );
}
