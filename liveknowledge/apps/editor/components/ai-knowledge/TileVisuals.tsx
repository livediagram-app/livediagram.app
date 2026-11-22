// The figures band's pictures (docs/specs/030-knowledgebase/ai-knowledge.md "Every tile draws a picture"): a 28px
// strip at each tile's foot, the same height as the Reads sparkline so the six line up. Each is hidden from screen
// readers; its words are said as the tile's description (FigureTiles passes them as `spoken`).
import type { KnowledgeConflict } from '@liveknowledge/api-schema';
import {
  OLD_WAIT_DAYS,
  TRACK_DAYS,
  type AgentShare,
  type QuestionBar,
  type VerifiedParts,
  type WaitingDot,
} from '@/lib/knowledge-ask/tile-visuals';
import { HEALTH_FILL } from './HealthAndContext';
import { AGENT_BG, PEOPLE_BG } from './ReadsSparkline';

const STRIP = 'mt-2 block h-7';
const CAPTION =
  'mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400';
const BAR = 'flex h-2 gap-px overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800';
const HAIRLINE = 'block h-px w-full bg-slate-200 dark:bg-slate-700';

/** The agents' tones, most reading first, then Others in grey: light to dark steps apart in both themes. */
const AGENT_TONES = [
  'bg-brand-700 dark:bg-brand-300',
  'bg-brand-500 dark:bg-brand-400',
  'bg-brand-400 dark:bg-brand-600',
  'bg-brand-200 dark:bg-brand-800',
];
const OTHERS_TONE = 'bg-slate-300 dark:bg-slate-600';

// A piece of a bar: its share of the width, never thinner than 2px so a small share still shows.
const piece = (share: number) => ({ flexGrow: share, flexBasis: 0, minWidth: 2 });

function Dot({ tone }: { tone: string }) {
  return <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} />;
}

/** Connected Agents: each agent's share of this week's agent reads, and who reads most. */
export function AgentShareBar({
  shares,
  caption,
}: {
  shares: readonly AgentShare[];
  caption: string;
}) {
  // Others is only ever the fifth piece, past the four tones.
  const tone = (at: number) => AGENT_TONES[at] ?? OTHERS_TONE;
  return (
    <span aria-hidden data-tile-visual="agents" className={STRIP}>
      <span className={BAR}>
        {shares.map((share, at) => (
          <span key={share.name} className={tone(at)} style={piece(share.share)} />
        ))}
      </span>
      <span className={CAPTION}>
        {shares[0] ? <Dot tone={tone(0)} /> : null}
        <span className="truncate">{caption}</span>
      </span>
    </span>
  );
}

/** Open Questions: a bar per question, its height its asks, people under agents, scaled to the most asked. */
export function QuestionBars({ bars }: { bars: readonly QuestionBar[] }) {
  if (bars.length === 0)
    return (
      <span aria-hidden data-tile-visual="questions" className={`${STRIP} flex items-end`}>
        <span className={HAIRLINE} />
      </span>
    );
  const most = Math.max(...bars.map((bar) => bar.asked));
  return (
    <span aria-hidden data-tile-visual="questions" className={`${STRIP} flex items-end gap-[3px]`}>
      {bars.map((bar) => (
        <span
          key={bar.key}
          data-question-bar={bar.asked}
          className="flex max-w-[14px] flex-1 flex-col justify-end overflow-hidden rounded-[2px]"
          style={{ height: `${Math.max(8, (bar.asked / most) * 100)}%` }}
        >
          {bar.agents > 0 ? <span className={AGENT_BG} style={{ flexGrow: bar.agents }} /> : null}
          {bar.people > 0 ? <span className={PEOPLE_BG} style={{ flexGrow: bar.people }} /> : null}
        </span>
      ))}
    </span>
  );
}

const PAGE_LINE =
  'flex min-w-0 items-center text-[11px] font-medium leading-[14px] text-slate-700 dark:text-slate-200';

/** Pages That Disagree: the oldest conflict's two pages, a not-equal mark between, and how many more are open. */
export function ConflictPair({
  oldest,
}: {
  oldest: { conflict: KnowledgeConflict; others: number } | null;
}) {
  if (!oldest)
    return (
      <span aria-hidden data-tile-visual="conflicts" className={`${STRIP} flex items-end`}>
        <span className={HAIRLINE} />
      </span>
    );
  const { a, b } = oldest.conflict;
  // The two pages on two lines, so each title has the tile's width; the second starts with the not-equal mark.
  return (
    <span
      aria-hidden
      data-tile-visual="conflicts"
      className={`${STRIP} flex flex-col justify-center`}
    >
      <span className={PAGE_LINE}>
        <span className="w-3 shrink-0" />
        <span className="truncate">{a.title}</span>
      </span>
      <span className={PAGE_LINE}>
        <span className="w-3 shrink-0 font-semibold text-amber-600 dark:text-amber-400">≠</span>
        <span className="truncate">{b.title}</span>
        {oldest.others > 0 ? (
          <span className="ml-auto shrink-0 pl-1 font-medium tabular-nums text-slate-500 dark:text-slate-400">
            +{oldest.others}
          </span>
        ) : null}
      </span>
    </span>
  );
}

// The track's dots: 6px, 7px a step up the stack, three rows at most (a busier day still shows as three).
const STACK_ROWS = 3;

/** Suggested Edits: the last TRACK_DAYS days, today at the right, a dot per waiting edit on the day it came. */
export function WaitingTrack({ dots }: { dots: readonly WaitingDot[] }) {
  const last = TRACK_DAYS - 1;
  return (
    <span aria-hidden data-tile-visual="suggestions" className={`${STRIP} relative`}>
      <span className="absolute inset-x-1 bottom-3 top-0">
        {dots
          .filter((dot) => dot.stack < STACK_ROWS)
          .map((dot) => (
            <span
              key={dot.id}
              data-wait-days={dot.days}
              className={`absolute h-1.5 w-1.5 -translate-x-1/2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                dot.old ? 'bg-amber-500' : 'bg-brand-600 dark:bg-brand-400'
              }`}
              style={{ left: `${((last - dot.days) / last) * 100}%`, bottom: 2 + dot.stack * 7 }}
            />
          ))}
      </span>
      {/* The track: a hairline, the week-old mark a touch darker. */}
      <span className="absolute inset-x-1 bottom-3 h-px bg-slate-200 dark:bg-slate-700" />
      <span
        className="absolute bottom-2.5 h-[5px] w-px bg-slate-300 dark:bg-slate-600"
        style={{ left: `calc(0.25rem + (100% - 0.5rem) * ${(last - OLD_WAIT_DAYS) / last})` }}
      />
      <span className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] leading-[10px] text-slate-500 dark:text-slate-400">
        <span>2 wk</span>
        <span>1 wk</span>
        <span>Today</span>
      </span>
    </span>
  );
}

/** Verified: every page in three parts, with a legend of each count. */
export function VerifiedBar({ parts }: { parts: VerifiedParts }) {
  const pieces = [
    { key: 'verified', n: parts.verified, word: 'verified', tone: HEALTH_FILL.verified },
    { key: 'reviewDue', n: parts.due, word: 'due', tone: HEALTH_FILL.reviewDue },
    { key: 'neverVerified', n: parts.never, word: 'never', tone: HEALTH_FILL.neverVerified },
  ].filter((part) => part.n > 0);
  return (
    <span aria-hidden data-tile-visual="verified" className={STRIP}>
      <span className={BAR}>
        {pieces.map((part) => (
          <span key={part.key} className={part.tone} style={piece(part.n / parts.total)} />
        ))}
      </span>
      <span className={`${CAPTION} gap-x-2.5 overflow-hidden`}>
        {pieces.length === 0 ? <span className="truncate">Nothing to verify</span> : null}
        {pieces.map((part) => (
          <span key={part.key} className="flex items-center gap-1 whitespace-nowrap">
            <Dot tone={part.tone} />
            <span className="tabular-nums">{part.n.toLocaleString('en')}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
