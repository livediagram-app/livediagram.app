'use client';

// The face of a Picker (docs/specs/012-collaboration/picker.md), one copy for every editor that has it: a slot
// reel behind a payline, the count in the corner, and the Spin button.
//
// The spin is local theatre over a result that was already decided when the button was pressed
// (rollPicker). Everyone lands on the same answer because the PRESSER writes it to the element.
//
// THE ROOM WATCHES THE SAME SPIN. A result arriving from anywhere BUT our own roll replays the reel
// locally, landing on what the element now says. Nothing extra goes over the wire: the element update
// the presser was already sending is the cue. Every client runs its own reel from its own candidate
// list, and they all end on the written result.
//
// Remove Once Drawn: the pool is the candidates minus the names drawn this round (`drawn`, written
// with the result in one update), so every client sees the same names left.

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
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

export function PickerFace<P extends PickerPerson = PickerPerson>({
  label,
  result,
  candidates,
  source = 'participants',
  removeDrawn = false,
  drawn,
  textColor,
  strokeColor,
  width,
  height,
  shared = false,
  onRoll,
  onReset,
  renderAvatar,
}: {
  // The element's own label, shown small above the reel ("Who demos?").
  label: string;
  // The last result, from the element, so a reload or a late join still shows what the room landed on.
  result: string | undefined;
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
  // A private roll (written nowhere) stays on OUR payline until the room's result next changes; before,
  // it showed for one frame and snapped back to the room's answer.
  const [privatePick, setPrivatePick] = useState<PickerCandidate<P> | null>(null);
  // Matched back to a live person where we can, so the winner keeps their avatar after a reload.
  const settled: PickerCandidate<P> | null = privatePick ?? (result ? find(result) : null);
  // The reel's order: the pool, with the name on the payline kept in its place.
  const inPool = new Set(pool.map((c) => c.label));
  const ring = candidates.filter((c) => inPool.has(c.label) || c.label === result);
  if (settled && !ring.some((c) => c.label === settled.label)) ring.push(settled);

  const [spin, setSpin] = useState<{ strip: (PickerCandidate<P> | null)[]; ms: number } | null>(
    null,
  );
  const [landKey, setLandKey] = useState(0);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const id of pending) window.clearTimeout(id);
    };
  }, []);

  // Run the reel from what stands on the payline (`from`) into `landed`. Shared by our own press and
  // by a result arriving from the room. The ring always holds the landing: our own roll lands in the
  // pool, and a peer's is the result this render already carries, kept on the ring as `settled`.
  const runReel = (from: PickerCandidate<P> | null, landed: PickerCandidate<P>, keep: boolean) => {
    const frames = spinReel(ring, landed).slice(0, -1);
    const ms = prefersReducedMotion() ? CALM_SPIN_MS : PICKER_SPIN_MS;
    setSpin({ strip: spinStrip(ring, from, frames, landed), ms });
    const id = window.setTimeout(() => {
      setSpin(null);
      setPrivatePick(keep ? landed : null);
      setLandKey((k) => k + 1);
    }, ms);
    timers.current.push(id);
  };

  // What our own last written roll landed on, so the effect below can tell our press from the room's.
  const ourRoll = useRef<string | undefined>(undefined);
  // The last result already accounted for, seeded from the first render, so joining after a roll
  // shows the answer rather than replaying a spin nobody is waiting for. Keyed on the landing alone
  // (an effect event): somebody joining the room must not re-spin a result that already landed.
  const seenResult = useRef(result);
  const onResult = useEffectEvent((next: string | undefined) => {
    if (next === seenResult.current) return;
    const before = privatePick ?? (seenResult.current ? find(seenResult.current) : null);
    seenResult.current = next;
    setPrivatePick(null);
    // One press writes at most one result change, so the arming is spent here either way.
    const ours = next !== undefined && next === ourRoll.current;
    ourRoll.current = undefined;
    // Cleared (a Reset, an undo): no landing to watch.
    if (next === undefined || ours) return;
    runReel(before, find(next), false);
  });
  useEffect(() => onResult(result), [result]);

  const spinning = spin !== null;
  // The Spin button is disabled while the reel turns, so a press here is always a fresh one.
  const roll = (rollOne: () => PickerCandidate<P> | null) => {
    const landed = rollOne();
    if (landed === null) return;
    if (shared) ourRoll.current = landed.label;
    runReel(settled, landed, !shared);
  };

  const drawnNames = removeDrawn
    ? drawnStillListed(candidates, drawn).filter((n) => n !== result)
    : [];
  const caption = allDrawn && !spinning;
  const layout = pickerLayout(width, height, {
    longest: ring.reduce((n, c) => Math.max(n, c.label.length), 0),
    controls: !!onRoll && (!caption || !!onReset),
    drawn: drawnNames.length > 0 && !spinning,
    caption,
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

  const [above, below] = allDrawn ? [null, null] : besideRows(ring, settled?.label);
  const restStrip = [above, settled, below];
  const count = pickerCountText({ source, total, left: pool.length, removeDrawn });
  const placeholder =
    total === 0 ? (
      <span className="text-[13px] font-medium" style={{ color: 'var(--picker-muted)' }}>
        Nothing to pick from
      </span>
    ) : (
      <span
        className="font-bold"
        style={{ fontSize: layout.nameSize * 1.1, color: 'var(--picker-muted)' }}
      >
        ?
      </span>
    );

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center gap-1.5 overflow-hidden px-2 py-2"
      style={vars}
      data-picker-state={
        spinning ? 'spinning' : allDrawn ? 'all-drawn' : settled ? 'landed' : 'ready'
      }
    >
      {layout.header && (label.trim() || count) ? (
        // pr-7: the element's own corner menu sits over the top-right of every face.
        <div className="flex w-full min-w-0 items-center justify-between gap-2 pl-1 pr-7">
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
      ) : null}
      <PickerReel
        strip={spin?.strip ?? restStrip}
        spinning={spinning}
        durationMs={spin?.ms ?? PICKER_SPIN_MS}
        landKey={landKey}
        layout={layout}
        placeholder={placeholder}
        renderAvatar={renderAvatar}
      />
      {/* What the reel says, for a screen reader: the landing, never the frames flicking past. */}
      <span className="sr-only" aria-live="polite">
        {spinning ? '' : (settled?.label ?? '')}
      </span>
      {caption ? (
        <p
          className="px-2 text-center text-[11px] font-medium"
          style={{ color: 'var(--picker-muted)' }}
        >
          {source === 'participants' ? 'Everyone’s had a turn' : 'Every option is drawn'}
          {onReset ? '' : '. Waiting for a reset.'}
        </p>
      ) : null}
      {layout.drawnList ? <DrawnNames names={drawnNames} /> : null}
      {onRoll ? (
        <div className="flex items-center gap-1.5">
          {allDrawn && !spinning ? (
            onReset ? (
              <ResetButton onReset={onReset} prominent />
            ) : null
          ) : (
            <>
              <SpinButton
                spinning={spinning}
                hasResult={settled !== null}
                disabled={pool.length === 0}
                onSpin={() => roll(onRoll)}
              />
              {onReset && removeDrawn && (drawn?.length ?? 0) > 0 && !spinning ? (
                <ResetButton onReset={onReset} prominent={false} />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
