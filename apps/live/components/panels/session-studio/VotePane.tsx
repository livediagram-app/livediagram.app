'use client';

// The dot vote tool (docs/specs/012-collaboration/session-tools.md, docs/specs/012-collaboration/vote-layer-scope.md).
//
// Setting up, every choice is drawn as the thing it produces: the dot budget
// is a row of dots you tap, the privacy switches are cards that say what the
// room will and won't see. A running vote opens the Vote panel instead
// (components/panels/VotePanel.tsx): turnout, the rules in force, the results.

import { useState, type ReactNode } from 'react';
import { VOTE_DOTS_RANGE } from '@livediagram/document';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { StudioButton, StudioLabel, StudioSegmented } from './studio-ui';
import { SOLID_BRAND_DARK, Glyph } from '@livediagram/ui';

type VotePaneProps = Pick<
  SessionToolsProps,
  | 'vote'
  | 'voteLayers'
  | 'activeLayerId'
  | 'onStartVote'
  | 'onEndVote'
  | 'onRevealVote'
  | 'onClearVote'
  | 'facilitating'
> & { selfId: string };

export function VotePane(props: VotePaneProps) {
  // A running vote opens the Vote panel instead (docs/specs/012-collaboration/session-tools.md), so this
  // pane is the set-up alone.
  return <VoteSetupForm {...props} />;
}

function VoteSetupForm(props: VotePaneProps) {
  const [dots, setDots] = useState(3);
  return <VoteSetupBody {...props} dots={dots} onDotsChange={setDots} />;
}

const STACKING_OPTIONS = [
  { value: 'stack', label: 'Any number' },
  { value: 'one', label: 'One each' },
] as const;

/**
 * The vote's setup UI, CONTROLLED on the dot budget (docs/specs/012-collaboration/session-tools.md).
 *
 * Exported so a vote element's `…` menu and its right-click Session category
 * render this exact form rather than their own take on it. In the Studio
 * `dots` is local state; on an element it is the element's stored budget, so
 * picking a number sets the button and Start runs it now with that number.
 */
export function VoteSetupBody({
  voteLayers,
  activeLayerId,
  onStartVote,
  dots,
  onDotsChange,
}: Pick<VotePaneProps, 'voteLayers' | 'activeLayerId' | 'onStartVote'> & {
  dots: number;
  onDotsChange: (dots: number) => void;
}) {
  // Cursors hidden by default: the leak they cause is invisible to the
  // facilitator, so it's the safer default. Running counts shown by default,
  // because live tallies are how ordinary dot-voting works (docs/specs/012-collaboration/session-tools.md).
  const [hideCursors, setHideCursors] = useState(true);
  const [hideCounts, setHideCounts] = useState(false);
  // Stacking is the classic dot-vote, so it stays the default; one per item
  // turns the budget into "pick your top N" instead of "back your favourite".
  const [stacking, setStacking] = useState<'stack' | 'one'>('stack');
  // '' is the explicit "all layers" choice (docs/specs/012-collaboration/vote-layer-scope.md).
  const [layerId, setLayerId] = useState(activeLayerId);
  const multiLayer = voteLayers.length > 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <StudioLabel aside={`${dots} each`}>Dots per person</StudioLabel>
        <DotBudgetPicker value={dots} onChange={onDotsChange} />
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
          <span className="text-[10px] leading-snug text-slate-400">
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
          <span className="text-[10px] leading-snug text-slate-400">
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
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-500'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
          checked
            ? `bg-brand-500 text-white ${SOLID_BRAND_DARK}`
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

function CursorOffGlyph() {
  return (
    <Glyph size={14} units={16}>
      <path d="M3.5 2.5l3.2 10 1.6-4.2 4.2-1.6z" />
      <path d="M2 14L14 2" />
    </Glyph>
  );
}

function TallyOffGlyph() {
  return (
    <Glyph size={14} units={16}>
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="1.8" />
      <path d="M2.5 13.5l11-11" />
    </Glyph>
  );
}
