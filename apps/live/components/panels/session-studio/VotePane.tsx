'use client';

// The dot vote tool (spec/39, spec/96).
//
// Setting up, every choice is drawn as the thing it produces: the dot budget
// is a row of dots you tap, the privacy switches are cards that say what the
// room will and won't see. Running, the pane becomes a facilitator's console:
// a three-step track (Voting, Closed, Results) showing where the round is,
// live turnout, the rules in force, and ONE primary button for the next
// step, so the flow is always "press the big button".

import { useState, type ReactNode } from 'react';
import {
  VOTE_DOTS_RANGE,
  isVoteHost,
  voteHidesCursors,
  voteHidesTallies,
  type TabVote,
} from '@livediagram/diagram';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { votePhase, voteTurnout, type VotePhase } from './session-studio';
import { StudioButton, StudioCallout, StudioLabel, StudioSegmented } from './studio-ui';

type VotePaneProps = Pick<
  SessionToolsProps,
  | 'vote'
  | 'voteLayers'
  | 'activeLayerId'
  | 'onStartVote'
  | 'onEndVote'
  | 'onRevealVote'
  | 'onClearVote'
> & { selfId: string };

export function VotePane(props: VotePaneProps) {
  return props.vote ? <LiveVote {...props} vote={props.vote} /> : <VoteSetupForm {...props} />;
}

const STACKING_OPTIONS = [
  { value: 'stack', label: 'Any number' },
  { value: 'one', label: 'One each' },
] as const;

function VoteSetupForm({ voteLayers, activeLayerId, onStartVote }: VotePaneProps) {
  const [dots, setDots] = useState(3);
  // Cursors hidden by default: the leak they cause is invisible to the
  // facilitator, so it's the safer default. Running counts shown by default,
  // because live tallies are how ordinary dot-voting works (spec/39).
  const [hideCursors, setHideCursors] = useState(true);
  const [hideCounts, setHideCounts] = useState(false);
  // Stacking is the classic dot-vote, so it stays the default; one per item
  // turns the budget into "pick your top N" instead of "back your favourite".
  const [stacking, setStacking] = useState<'stack' | 'one'>('stack');
  // '' is the explicit "all layers" choice (spec/96).
  const [layerId, setLayerId] = useState(activeLayerId);
  const multiLayer = voteLayers.length > 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <StudioLabel aside={`${dots} each`}>Dots per person</StudioLabel>
        <DotBudgetPicker value={dots} onChange={setDots} />
      </div>
      {/* With a single dot there is nothing to stack, so the choice would be
          a question with one answer. */}
      {dots > 1 ? (
        <div className="flex flex-col gap-1.5">
          <StudioLabel>Dots per item</StudioLabel>
          <StudioSegmented
            label="Dots per item"
            value={stacking}
            onChange={setStacking}
            options={STACKING_OPTIONS}
          />
          <span className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">
            {stacking === 'one'
              ? `Each person backs ${dots} different items, one dot apiece.`
              : 'People can pile several dots on one item they feel strongly about.'}
          </span>
        </div>
      ) : null}
      {multiLayer ? (
        <div className="flex flex-col gap-1.5">
          <StudioLabel>Votable layer</StudioLabel>
          <StudioSegmented
            label="Votable layer"
            value={layerId}
            onChange={setLayerId}
            options={[
              { value: '', label: 'All layers' },
              ...voteLayers.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
          <span className="text-[10px] leading-snug text-slate-400 dark:text-slate-500">
            {layerId
              ? 'Only this layer takes dots. The rest stay visible, dimmed.'
              : 'Every votable element on the tab takes dots.'}
          </span>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <StudioLabel>Privacy</StudioLabel>
        <PrivacyCard
          icon={<CursorOffGlyph />}
          title="Hide cursors"
          hint="Nobody can watch where others are pointing."
          checked={hideCursors}
          onToggle={() => setHideCursors((v) => !v)}
        />
        <PrivacyCard
          icon={<TallyOffGlyph />}
          title="Hide running counts"
          hint="Totals stay secret until you reveal them."
          checked={hideCounts}
          onToggle={() => setHideCounts((v) => !v)}
        />
      </div>
      <StudioButton
        variant="primary"
        onClick={() =>
          onStartVote(dots, {
            hideCursors,
            hideCounts,
            layerId: multiLayer && layerId ? layerId : undefined,
            onePerElement: dots > 1 && stacking === 'one',
          })
        }
      >
        Start vote
      </StudioButton>
    </div>
  );
}

// The budget as the dots themselves: tap the fifth dot for five each. Reads
// as what every participant will be handed, which a bare "3" stepper never
// did.
function DotBudgetPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const count = VOTE_DOTS_RANGE.max - VOTE_DOTS_RANGE.min + 1;
  return (
    <div
      role="radiogroup"
      aria-label="Dots per person"
      className="flex items-center rounded-lg bg-slate-50 px-1 py-1.5 dark:bg-slate-800/70"
      onPointerLeave={() => setHover(null)}
    >
      {Array.from({ length: count }, (_, i) => {
        const n = i + VOTE_DOTS_RANGE.min;
        const filled = n <= shown;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} ${n === 1 ? 'dot' : 'dots'} each`}
            onClick={() => onChange(n)}
            onPointerEnter={() => setHover(n)}
            className="flex h-6 min-w-0 flex-1 items-center justify-center"
          >
            <span
              className={`block rounded-full transition-all ${
                filled
                  ? 'h-3.5 w-3.5 bg-brand-500 shadow-sm'
                  : 'h-2.5 w-2.5 border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function PrivacyCard({
  icon,
  title,
  hint,
  checked,
  onToggle,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
        checked
          ? 'border-brand-300 bg-brand-50/60 dark:border-brand-500/50 dark:bg-brand-500/10'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
          checked
            ? 'bg-brand-500 text-white'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
        }`}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          {title}
        </span>
        <span className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
      <ToggleSwitch checked={checked} label={title} presentational />
    </button>
  );
}

const PHASES: { phase: Exclude<VotePhase, 'setup'>; label: string }[] = [
  { phase: 'casting', label: 'Voting' },
  { phase: 'closed', label: 'Ended' },
  { phase: 'results', label: 'Results' },
];

function PhaseTrack({ phase }: { phase: VotePhase }) {
  const at = PHASES.findIndex((p) => p.phase === phase);
  return (
    <ol className="flex items-center" aria-label="Vote progress">
      {PHASES.map((p, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={p.phase} className="flex flex-1 items-center last:flex-none">
            <span className="flex flex-col items-center gap-1">
              <span
                aria-current={current ? 'step' : undefined}
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  current
                    ? 'bg-brand-500 text-white ring-4 ring-brand-500/15'
                    : done
                      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  current
                    ? 'text-slate-800 dark:text-slate-100'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {p.label}
              </span>
            </span>
            {i < PHASES.length - 1 ? (
              <span
                className={`mx-1 mb-4 h-0.5 flex-1 rounded-full ${
                  done ? 'bg-brand-300 dark:bg-brand-500/50' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function LiveVote({
  vote,
  selfId,
  voteLayers,
  onEndVote,
  onRevealVote,
  onClearVote,
}: VotePaneProps & { vote: TabVote }) {
  const phase = votePhase(vote);
  const { dots, voters } = voteTurnout(vote);
  const host = isVoteHost(vote, selfId);
  const rules = [
    `${vote.votesPerPerson} ${vote.votesPerPerson === 1 ? 'dot' : 'dots'} each`,
    vote.onePerElement ? 'One per item' : null,
    vote.voteLayerId
      ? `${voteLayers.find((l) => l.id === vote.voteLayerId)?.name ?? 'One layer'} only`
      : null,
    // Phase-aware: these read what is in force NOW (cursors come back the
    // moment voting closes), not what was ticked at start.
    voteHidesCursors(vote) ? 'Cursors hidden' : null,
    voteHidesTallies(vote) ? 'Counts hidden' : null,
  ].filter((r): r is string => r !== null);

  return (
    <div className="flex flex-col gap-3">
      <PhaseTrack phase={phase} />
      <div className="grid grid-cols-2 gap-1.5">
        <Stat value={dots} label={dots === 1 ? 'dot placed' : 'dots placed'} live={vote.active} />
        <Stat value={voters} label={voters === 1 ? 'person voted' : 'people voted'} />
      </div>
      <div className="flex flex-wrap gap-1">
        {rules.map((r) => (
          <span
            key={r}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {r}
          </span>
        ))}
      </div>
      {host ? (
        <div className="flex flex-col gap-1.5">
          {phase === 'casting' ? (
            <StudioButton variant="primary" onClick={onEndVote}>
              End vote
            </StudioButton>
          ) : phase === 'closed' ? (
            <StudioButton variant="primary" onClick={onRevealVote}>
              Show results
            </StudioButton>
          ) : (
            <StudioButton variant="primary" onClick={onClearVote}>
              Clear vote
            </StudioButton>
          )}
          {phase !== 'results' ? (
            <StudioButton variant="danger" onClick={onClearVote}>
              Clear vote
            </StudioButton>
          ) : null}
          <span className="text-center text-[10px] leading-snug text-slate-400 dark:text-slate-500">
            {phase === 'casting'
              ? 'Ending keeps every dot; nobody can add more.'
              : phase === 'closed'
                ? 'Showing results walks the room through the winners, most dots first.'
                : 'Clearing takes every dot off the board.'}
          </span>
        </div>
      ) : (
        <StudioCallout>Only the person who started this vote can move it on.</StudioCallout>
      )}
    </div>
  );
}

function Stat({ value, label, live = false }: { value: number; label: string; live?: boolean }) {
  return (
    <div className="flex flex-col rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/70">
      <span className="flex items-center gap-1.5 text-[20px] font-semibold leading-none tabular-nums text-slate-800 dark:text-slate-100">
        {value}
        {live ? (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
        ) : null}
      </span>
      <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

function CursorOffGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 2.5l3.2 10 1.6-4.2 4.2-1.6z" />
      <path d="M2 14L14 2" />
    </svg>
  );
}

function TallyOffGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="1.8" />
      <path d="M2.5 13.5l11-11" />
    </svg>
  );
}
