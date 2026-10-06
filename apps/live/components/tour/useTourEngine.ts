'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useAssignRef } from '@/hooks/ui/useLatest';
import { findTour, waitForSelector } from './tour-dom';
import { hasAnchor, type TourStepOf } from './tour-step';

// The step runner every guided tour shares (docs/specs/007-editor/editor-tour.md "Mechanics",
// docs/specs/026-plan/blueprints/plan-tour.md "Engine"): the welcome tour and the Plan tour each own
// their offer, their steps and what ending means, and hand this the rest. Each step runs prepare
// (opening the real panel / dropdown / menu it explains), waits for its target node, then reports a
// rect for the dimming highlight ring. A watcher re-measures the target every 150ms so the highlight
// tracks layout changes, and re-runs prepare if the target is dismissed mid-step (an outside click
// closing a menu). The last rect is kept while the next step prepares, so the ring GLIDES between
// targets (transition-all) instead of blinking out and back.

// How long a step waits for its target before it is skipped.
export const TARGET_WAIT_MS = 3500;
// How often a shown target is re-measured.
const TRACK_MS = 150;

// Plain rect (not DOMRect): dropdown steps highlight the UNION of the
// trigger and its portalled menu, which getBoundingClientRect can't hand
// us directly.
export type TourTargetRect = { left: number; top: number; width: number; height: number };

export type TourOutcome = 'completed' | 'skipped' | 'declined';

const rectsEqual = (a: TourTargetRect, b: TourTargetRect) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

const toRect = (r: DOMRect): TourTargetRect => ({
  left: r.left,
  top: r.top,
  width: r.width,
  height: r.height,
});

const unionRects = (a: TourTargetRect, b: TourTargetRect): TourTargetRect => {
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return {
    left,
    top,
    width: Math.max(a.left + a.width, b.left + b.width) - left,
    height: Math.max(a.top + a.height, b.top + b.height) - top,
  };
};

// Rect for a step's highlight: the target itself, unioned with the
// optional secondary anchor (dropdown steps wrap trigger + menu as one).
function measureStep(el: HTMLElement, alsoHighlight?: string): TourTargetRect {
  const base = toRect(el.getBoundingClientRect());
  if (!alsoHighlight) return base;
  const also = findTour(alsoHighlight);
  if (!also || !also.isConnected) return base;
  const r = also.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return base;
  return unionRects(base, toRect(r));
}

// The anchor a step waits for: its own selector, else its data-tour-id.
function anchorSelector<Api>(step: TourStepOf<Api>, api: Api): string | null {
  if (step.selector) return step.selector(api);
  return step.target ? `[data-tour-id="${step.target}"]` : null;
}

async function waitForAnchor<Api>(step: TourStepOf<Api>, api: Api): Promise<HTMLElement | null> {
  const selector = anchorSelector(step, api);
  return selector ? waitForSelector(selector, TARGET_WAIT_MS) : null;
}

export function useTourEngine<Api>({
  steps,
  apiRef,
  onStepView,
  onStart,
  onFinish,
}: {
  steps: readonly TourStepOf<Api>[];
  // Rebuilt every render by the host so step callbacks always see fresh handlers.
  apiRef: RefObject<Api>;
  // Once per step entry (a Back re-entry counts); never for the welcome card, whose view is the offer.
  onStepView: (step: TourStepOf<Api>) => void;
  // The welcome card's accept: the tour proper starts.
  onStart?: () => void;
  // The tour ran out (completed), was skipped mid-way, or was declined at the welcome card.
  onFinish: (outcome: TourOutcome) => void;
}) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  // Direction of the last step change, for the popover content's
  // directional slide (the TemplatePicker wizard's tip-next / tip-prev).
  const [stepDir, setStepDir] = useState<'forward' | 'backward'>('forward');
  const [targetRect, setTargetRect] = useState<TourTargetRect | null>(null);
  const targetElRef = useRef<HTMLElement | null>(null);
  // Monotonic token: bumping it invalidates any in-flight async step run
  // (prepare + waits) so a fast Next/Next can't land a stale target.
  const runTokenRef = useRef(0);
  const healingRef = useRef(false);
  // Reached from the step-run effect without depending on their per-render identity.
  const onFinishRef = useRef(onFinish);
  useAssignRef(onFinishRef, onFinish);
  const onStepViewRef = useRef(onStepView);
  useAssignRef(onStepViewRef, onStepView);
  // finish, reachable from the step-run effect (declared here, kept current below its definition).
  const finishRef = useRef<(outcome: TourOutcome) => void>(() => {});

  // The step list can SHRINK mid-tour (crossing the mobile breakpoint
  // drops the desktop-only step): clamp the index so the effects and
  // render below never read past the end. Adjusted during render.
  if (stepIndex > steps.length - 1 && steps.length > 0) setStepIndex(steps.length - 1);

  // Run the current step: prepare, then await the target node. The
  // previous step's rect stays on screen meanwhile, so the ring glides to
  // the new target when it lands.
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIndex];
    if (!step) return; // an empty list: nothing to run
    if (step.card !== 'welcome') onStepViewRef.current(step);
    const token = ++runTokenRef.current;
    let cancelled = false;
    void (async () => {
      const api = apiRef.current;
      if (!hasAnchor(step)) {
        // Anchorless (welcome / outro) card: centred, no highlight. Its prepare still runs.
        targetElRef.current = null;
        setTargetRect(null);
        try {
          await step.prepare?.(api);
        } catch {
          // Nothing hangs on an anchorless card's prepare.
        }
        return;
      }
      try {
        await step.prepare?.(api);
      } catch {
        // A failed prepare falls through to the target wait; a missing
        // target then skips the step rather than wedging the tour.
      }
      if (cancelled || token !== runTokenRef.current) return;
      const el = await waitForAnchor(step, apiRef.current);
      if (cancelled || token !== runTokenRef.current) return;
      if (!el) {
        // Target never appeared: skip forward (or finish from the last step).
        step.cleanup?.(apiRef.current);
        if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
        else finishRef.current('completed');
        return;
      }
      targetElRef.current = el;
      setTargetRect(measureStep(el, step.alsoHighlight));
    })();
    return () => {
      cancelled = true;
    };
  }, [active, apiRef, stepIndex, steps]);

  // Track the target while a step is showing: follow it when it moves and
  // re-run prepare when it disappears (a menu dismissed under the tour).
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIndex];
    if (!step || !hasAnchor(step)) return;
    const id = window.setInterval(() => {
      const el = targetElRef.current;
      if (!el) return;
      if (!el.isConnected) {
        if (healingRef.current) return;
        healingRef.current = true;
        targetElRef.current = null;
        const token = ++runTokenRef.current;
        void (async () => {
          try {
            await step.prepare?.(apiRef.current);
            const next = await waitForAnchor(step, apiRef.current);
            if (token === runTokenRef.current && next) {
              targetElRef.current = next;
              setTargetRect(measureStep(next, step.alsoHighlight));
            }
          } finally {
            healingRef.current = false;
          }
        })();
        return;
      }
      const r = measureStep(el, step.alsoHighlight);
      setTargetRect((prev) => (prev && rectsEqual(prev, r) ? prev : r));
    }, TRACK_MS);
    return () => window.clearInterval(id);
  }, [active, apiRef, stepIndex, steps]);

  const reset = () => {
    runTokenRef.current++;
    targetElRef.current = null;
    setTargetRect(null);
  };

  // Ends without an outcome: the host's own reason (edit rights gone, the mode left).
  const stop = () => {
    reset();
    setActive(false);
  };

  const finish = (outcome: TourOutcome) => {
    stop();
    onFinishRef.current(outcome);
  };
  useAssignRef(finishRef, finish);

  const start = () => {
    reset();
    setStepIndex(0);
    setStepDir('forward');
    setActive(true);
  };

  const step = active ? steps[Math.min(stepIndex, steps.length - 1)] : undefined;

  const leaveStep = () => {
    runTokenRef.current++;
    targetElRef.current = null;
    if (step) step.cleanup?.(apiRef.current);
  };

  const next = () => {
    leaveStep();
    if (step?.card === 'welcome') onStart?.();
    setStepDir('forward');
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
    else finish('completed');
  };

  const back = () => {
    leaveStep();
    setStepDir('backward');
    setStepIndex(Math.max(0, stepIndex - 1));
  };

  const skip = () => {
    leaveStep();
    finish(step?.card === 'welcome' ? 'declined' : 'skipped');
  };

  return {
    active,
    step,
    stepIndex,
    stepDir,
    targetRect,
    // The bookend cards sit outside the step count: "1 of N" is the first real step.
    countableSteps: steps.filter((s) => !s.card).length,
    start,
    stop,
    next,
    back,
    skip,
  };
}

export type TourEngine<Api> = ReturnType<typeof useTourEngine<Api>>;
