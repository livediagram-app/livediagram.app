'use client';

// The face of a Picker (docs/specs/012-collaboration/picker.md), one copy for every editor that has it: a slot
// reel behind a payline, the count in the corner, and the Spin button.
//
// The spin is local theatre over a result that was already decided when the button was pressed
// (rollPicker). Everyone lands on the same answer because the PRESSER writes it to the element.
//
// THE ROOM WATCHES THE SAME SPIN. A press arriving from anywhere BUT our own roll replays the reel
// locally, landing on what the element now says. Nothing extra goes over the wire: the element update
// the presser was already sending is the cue, and its stamp (`rolledAt`, new on every press) tells a
// second landing on the same name from no press at all. The replay is worked out WHILE RENDERING the
// update, so no frame ever shows the winner standing still before the reel turns.
//
// Remove Once Drawn: the pool is the candidates minus the names drawn this round (`drawn`, written
// with the result in one update), so every client sees the same names left.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { colorWash } from '@liveworkspace/model-core/color-wash';
import { inkOn } from '@liveworkspace/element-model/colour-math';
import { prefersReducedMotion } from '@liveworkspace/ui';
import {
  PICKER_SPIN_MS,
  drawnStillListed,
  spinReel,
  undrawnCandidates,
  type PickerCandidate,
  type PickerPerson,
} from '../../../lib/picker';
import { useCanvasSurface } from '../CanvasSurfaceContext';
import {
  pickerAccent,
  pickerCountText,
  pickerLayout,
} from '@liveworkspace/element-model/picker-layout';
import { besideRows, spinStrip } from './picker-strip';
import { DrawnNames, ResetButton, SpinButton } from './picker-face-parts';
import { PickerReel } from './PickerReel';

// A reduced-motion landing: long enough to read as a change, with no scroll.
const CALM_SPIN_MS = 220;

type Spin<P extends PickerPerson> = {
  strip: (PickerCandidate<P> | null)[];
  ms: number;
  landed: PickerCandidate<P>;
  // A private roll stays on our payline once it lands; the room's answer is the element's.
  keep: boolean;
};

// Which press the element's result came from: the result and its stamp. An element written before the
// stamp existed keys on the result alone.
const pressOf = (result: string | undefined, rolledAt: number | undefined) =>
  result === undefined ? undefined : `${rolledAt ?? ''}:${result}`;

export function PickerFace<P extends PickerPerson = PickerPerson>({
  label,
  result,
  rolledAt,
  candidates,
  source = 'participants',
  removeDrawn = false,
  drawn,
  textColor,
  strokeColor,
  width,
  height,
  shared = false,
  cornerMenu = false,
  onRoll,
  onReset,
  renderAvatar,
}: {
  // The element's own label, shown small above the reel ("Who demos?").
  label: string;
  // The last result, from the element, so a reload or a late join still shows what the room landed on.
  result: string | undefined;
  // When that result's press happened (the element's pickerRolledAt), new on every press.
  rolledAt?: number;
  // Everyone or everything that can be picked, before Remove Once Drawn takes the drawn names out.
  candidates: PickerCandidate<P>[];
  source?: 'participants' | 'options';
  removeDrawn?: boolean;
  drawn?: readonly string[];
  textColor: string;
  // The element's own stroke (a theme's or the author's), which is the accent; unset uses the
  // Default scheme's accent for the paper.
  strokeColor?: string;
  width: number;
  height: number;
  // Does OUR roll get written to the element (and so reach the room)? It decides whether the
  // result change our own press causes is ours to skip: without it a private roll would arm the
  // skip and swallow the next genuine landing from somebody else.
  shared?: boolean;
  // The element's `…` settings button sits in the top-right corner, so keep clear of it.
  cornerMenu?: boolean;
  // Rolls and returns the result to show; absent for whoever may not spin.
  onRoll?: () => PickerCandidate<P> | null;
  // Puts every drawn name back; absent for whoever may not spin.
  onReset?: () => void;
  renderAvatar?: (participant: P, size: number) => ReactNode;
}) {
  const paper = useCanvasSurface();
  const pool = undrawnCandidates(candidates, drawn, removeDrawn);
  const total = candidates.length;
  const allDrawn = removeDrawn && total > 0 && pool.length === 0;
  const find = (label: string): PickerCandidate<P> =>
    candidates.find((c) => c.label === label) ?? { label };
  // A private roll (written nowhere) stays on OUR payline until the room's result next changes.
  const [privatePick, setPrivatePick] = useState<PickerCandidate<P> | null>(null);
  // Matched back to a live person where we can, so the winner keeps their avatar after a reload.
  const settled: PickerCandidate<P> | null = privatePick ?? (result ? find(result) : null);
  // The reel's order: the pool, with the name on the payline kept in its place.
  const inPool = new Set(pool.map((c) => c.label));
  const ring = candidates.filter((c) => inPool.has(c.label) || c.label === result);
  if (settled && !ring.some((c) => c.label === settled.label)) ring.push(settled);

  const [spin, setSpin] = useState<Spin<P> | null>(null);
  const [landKey, setLandKey] = useState(0);
  // The reel from what stands on the payline (`from`) into `landed`. The ring always holds the
  // landing: our own roll lands in the pool, and a peer's is the result this render carries.
  const spinInto = (
    from: PickerCandidate<P> | null,
    landed: PickerCandidate<P>,
    keep: boolean,
  ): Spin<P> => ({
    strip: spinStrip(ring, from, spinReel(ring, landed).slice(0, -1), landed),
    ms: prefersReducedMotion() ? CALM_SPIN_MS : PICKER_SPIN_MS,
    landed,
    keep,
  });
  useEffect(() => {
    if (!spin) return;
    const id = window.setTimeout(() => {
      setSpin(null);
      setPrivatePick(spin.keep ? spin.landed : null);
      setLandKey((k) => k + 1);
    }, spin.ms);
    return () => window.clearTimeout(id);
  }, [spin]);

  // The last press accounted for, seeded from the first render, so joining after a roll shows the
  // answer rather than replaying a spin nobody is waiting for. `armed` is our own shared roll's
  // landing, waiting for its echo from the element, which must not replay.
  const press = pressOf(result, rolledAt);
  const [seen, setSeen] = useState({ press, result });
  const [armed, setArmed] = useState<string | undefined>(undefined);
  if (press !== seen.press) {
    // A new press (or a Reset) arrived: worked out during this render, before anything paints.
    const before = privatePick ?? (seen.result ? find(seen.result) : null);
    setSeen({ press, result });
    setPrivatePick(null);
    // One press writes at most one result change, so the arming is spent here either way.
    setArmed(undefined);
    if (result !== undefined && result !== armed) setSpin(spinInto(before, find(result), false));
  }

  const spinning = spin !== null;
  // The Spin button is disabled while the reel turns, so a press here is always a fresh one.
  const roll = (rollOne: () => PickerCandidate<P> | null) => {
    const landed = rollOne();
    if (landed === null) return;
    if (shared) setArmed(landed.label);
    setSpin(spinInto(settled, landed, !shared));
  };

  const drawnNames = removeDrawn
    ? drawnStillListed(candidates, drawn).filter((n) => n !== result)
    : [];
  const roundOver = allDrawn && !spinning;
  // Reset mid-round, beside Spin.
  const resetBeside = removeDrawn && (drawn?.length ?? 0) > 0 && !spinning ? onReset : undefined;
  const layout = pickerLayout(width, height, {
    longest: ring.reduce((n, c) => Math.max(n, c.label.length), 0),
    controls: !!onRoll && (!roundOver || !!onReset),
    reset: !!resetBeside && !roundOver,
    drawn: drawnNames.length > 0 && !spinning,
    caption: roundOver,
    avatars: !!renderAvatar && source === 'participants',
    menu: cornerMenu,
  });
  const accent = pickerAccent(strokeColor, paper);
  const vars = {
    '--picker-accent': accent,
    '--picker-on-accent': inkOn(accent),
    '--picker-ink': textColor,
    '--picker-muted': colorWash(textColor, 0.62),
    '--picker-wash': colorWash(textColor, 0.07),
    '--picker-wash-strong': colorWash(textColor, 0.14),
    '--picker-band': colorWash(accent, 0.14),
    '--picker-band-edge': colorWash(accent, 0.4),
    '--picker-glow': colorWash(accent, 0.28),
  } as CSSProperties;

  const doneLine = source === 'participants' ? 'Everyone’s had a turn' : 'Every option is drawn';
  // With no room for the all-drawn line under the reel, the payline says it.
  const doneOnPayline = roundOver && !layout.caption;
  const [above, below] = allDrawn ? [null, null] : besideRows(ring, settled?.label);
  const restStrip = [above, doneOnPayline ? null : settled, below];
  const count = pickerCountText({ source, total, left: pool.length, removeDrawn });
  const muted = (text: string) => (
    <span
      className="text-center text-[13px] font-medium leading-tight"
      style={{ color: 'var(--picker-muted)' }}
    >
      {text}
    </span>
  );
  const placeholder = doneOnPayline ? (
    muted(layout.compact ? 'All drawn' : doneLine)
  ) : total === 0 ? (
    muted('Nothing to pick from')
  ) : (
    <span
      className="font-bold"
      style={{ fontSize: layout.nameSize * 1.1, color: 'var(--picker-muted)' }}
    >
      ?
    </span>
  );

  const reel = (
    <PickerReel
      strip={spin?.strip ?? restStrip}
      spinning={spinning}
      durationMs={spin?.ms ?? PICKER_SPIN_MS}
      landKey={landKey}
      layout={layout}
      placeholder={placeholder}
      renderAvatar={renderAvatar}
    />
  );
  const buttons = onRoll ? (
    <div className="flex shrink-0 items-center gap-1.5">
      {roundOver ? (
        onReset ? (
          <ResetButton onReset={onReset} prominent={!layout.compact} />
        ) : null
      ) : (
        <>
          <SpinButton
            spinning={spinning}
            hasResult={settled !== null}
            disabled={pool.length === 0}
            round={layout.compact}
            onSpin={() => roll(onRoll)}
          />
          {resetBeside ? <ResetButton onReset={resetBeside} prominent={false} /> : null}
        </>
      )}
    </div>
  ) : null;
  // What the reel says, for a screen reader: the landing, never the frames flicking past.
  const live = (
    <span className="sr-only" aria-live="polite">
      {spinning ? '' : (settled?.label ?? '')}
    </span>
  );
  const state = spinning ? 'spinning' : allDrawn ? 'all-drawn' : settled ? 'landed' : 'ready';

  if (layout.compact) {
    // One row: the payline beside a round Spin, the corner menu's gutter kept clear.
    return (
      <div
        className={`relative flex h-full w-full items-center gap-1.5 overflow-hidden py-2 pl-2 ${cornerMenu ? 'pr-7' : 'pr-2'}`}
        style={vars}
        data-picker-state={state}
        data-picker-layout="compact"
      >
        <div className="min-w-0 flex-1">{reel}</div>
        {buttons}
        {live}
      </div>
    );
  }
  return (
    <div
      className="relative flex h-full w-full flex-col items-center gap-1.5 overflow-hidden px-2 py-2"
      style={vars}
      data-picker-state={state}
    >
      {label.trim() || count ? (
        // The header, pinned to the top. pr-7 keeps the count clear of the element's corner menu.
        <div
          className={`flex w-full min-w-0 shrink-0 items-center justify-between gap-2 pl-1 ${cornerMenu ? 'pr-7' : 'pr-1'}`}
          style={{ minHeight: 18 }}
        >
          <span
            className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--picker-muted)' }}
          >
            {label.trim()}
          </span>
          {count ? (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
              style={{ color: 'var(--picker-ink)', backgroundColor: 'var(--picker-wash)' }}
            >
              <span className="text-optical-line">{count}</span>
            </span>
          ) : null}
        </div>
      ) : (
        <div className="shrink-0" style={{ height: 18 }} />
      )}
      {/* The reel fills what the header and the buttons leave, its payline in the middle. */}
      <div className="flex min-h-0 w-full flex-1 items-center">{reel}</div>
      {live}
      {layout.caption ? (
        <p
          className="shrink-0 px-2 text-center text-[11px] font-medium"
          style={{ color: 'var(--picker-muted)' }}
        >
          {doneLine}
          {onReset ? '' : '. Waiting for a reset.'}
        </p>
      ) : null}
      {layout.drawnList ? <DrawnNames names={drawnNames} /> : null}
      {buttons}
    </div>
  );
}
