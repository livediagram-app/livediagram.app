'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useAssignRef } from '@/hooks/ui/useLatest';
import { openModalCount, useOpenModalCount } from '@/lib/modal-guard';
import { findTour, waitForSelector } from './tour-dom';
import { revealInScrollers } from './tour-reveal';
import { hasAnchor, type TourStepOf } from './tour-step';

// The step runner every guided tour shares (docs/specs/007-editor/pages-tour.md "Mechanics"): the Pages tour, Show Me and the
// element tours each own their offer, their steps and what ending means, and hand this the rest. Each step runs prepare
// (opening the real panel / dropdown / menu it explains), waits for its target node, then reports a
// rect for the dimming highlight ring, scrolling the target into view first when it sits below a panel's fold
// (tour-reveal.ts). A watcher re-measures the target every 150ms so the highlight
// tracks layout changes, and re-runs prepare if the target is dismissed mid-step (an outside click
// closing a menu). The last rect is kept while the next step prepares, so the ring GLIDES between
// targets (transition-all) instead of blinking out and back.
//
// Dialogs come first (docs/specs/007-editor/pages-tour.md "Dialogs come first"): the engine keeps a baseline of
// the modal dialogs that are the tour's own (open when it started, or holding a step's target) and steps aside
// (`yielded`: the stage draws nothing, tracking pauses) while more are open than that, except while a step is still
// waiting for its target, which may be the tour opening its own dialog.

// How long a step waits for its target before it is skipped.
export const TARGET_WAIT_MS = 3500;
// How often a shown target is re-measured.
const TRACK_MS = 150;

// Plain rect (not DOMRect): dropdown steps highlight the UNION of the
// trigger and its portalled menu, which getBoundingClientRect can't hand
// us directly.
export type TourTargetRect = { left: number; top: number; width: number; height: number };

export type TourOutcome = 'completed' | 'skipped' | 'declined';

// Whether a found target belongs to a dialog the tour is showing: a step drawn over a dialog, or a target inside one.
function inTourDialog<Api>(step: TourStepOf<Api>, el: HTMLElement): boolean {
  return step.layer === 'modal' || el.closest('[aria-modal="true"]') !== null;
}

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

// How long a found target may keep moving or growing before the step lands on it anyway.
export const SETTLE_WAIT_MS = 600;

// A found target's own entrance (a dropdown or flyout opening, as a step's prepare asked) run to its end, or
// SETTLE_WAIT_MS: the CSS animations and transitions on it, on what it contains, and on its secondary anchor. A
// menu is found the moment it mounts, before it has visibly started opening; landing then sent the ring towards a
// half-open menu, chasing it as it grew while the menu ran its own animation.
async function entranceDone(els: readonly (Element | null)[]): Promise<boolean> {
  // Where the Web Animations API is missing (an older browser, the test DOM) there is nothing to wait for.
  const running = els.flatMap((el) =>
    el && typeof el.getAnimations === 'function' ? el.getAnimations({ subtree: true }) : [],
  );
  const looping = (a: Animation) => a.effect?.getComputedTiming().iterations === Infinity;
  const finite = running.filter((a) => !looping(a)).map((a) => a.finished.catch(() => undefined));
  if (finite.length === 0) return false;
  await Promise.race([
    Promise.all(finite),
    new Promise<void>((resolve) => setTimeout(resolve, SETTLE_WAIT_MS)),
  ]);
  return true;
}

// The rect once its entrance is done and three frames in a row agree, or the latest after SETTLE_WAIT_MS. A target with
// no entrance running is at rest already: it lands at once.
async function settledRect(
  measure: () => TourTargetRect,
  els: readonly (Element | null)[],
): Promise<TourTargetRect> {
  const started = performance.now();
  if (!(await entranceDone(els))) return measure();
  let last = measure();
  let steady = 0;
  for (;;) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const next = measure();
    steady = rectsEqual(last, next) ? steady + 1 : 0;
    if (steady >= 2 || performance.now() - started > SETTLE_WAIT_MS * 1.5) return next;
    last = next;
  }
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
  // Read by the step-run effect: a step whose target is missing is skipped the way the person was going.
  const stepDirRef = useRef(stepDir);
  useAssignRef(stepDirRef, stepDir);
  const [targetRect, setTargetRect] = useState<TourTargetRect | null>(null);
  // The step whose target was last found (or whose anchorless card is up): the stage shows a step only once it has
  // landed, so a step's copy never sits beside the previous step's target while its prepare opens a menu.
  const [landedIndex, setLandedIndex] = useState<number | null>(null);
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
  // The modal dialogs that are the tour's own; more open than this and the tour steps aside.
  const openModals = useOpenModalCount();
  const [modalBaseline, setModalBaseline] = useState(0);
  // A dialog closing lowers it, so one opened after (the person's own) is in the tour's way. Adjusted during render.
  if (active && openModals < modalBaseline) setModalBaseline(openModals);
  // A step between entering and finding its target (its prepare may be opening the tour's own dialog).
  const [awaitingTarget, setAwaitingTarget] = useState(false);
  // A dialog that is not the tour's is open: draw nothing and pause tracking until it closes.
  const yielded = active && !awaitingTarget && openModals > modalBaseline;
  // Takes a found target's dialog as the tour's own.
  const adoptDialogOf = (step: TourStepOf<Api>, el: HTMLElement) => {
    if (!inTourDialog(step, el)) return;
    const count = openModalCount();
    setModalBaseline((b) => Math.max(b, count));
  };
  const adoptRef = useRef(adoptDialogOf);
  useAssignRef(adoptRef, adoptDialogOf);

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
        setAwaitingTarget(false);
        setLandedIndex(stepIndex);
        try {
          await step.prepare?.(api);
        } catch {
          // Nothing hangs on an anchorless card's prepare.
        }
        return;
      }
      setAwaitingTarget(true);
      try {
        await step.prepare?.(api);
      } catch {
        // A failed prepare falls through to the target wait; a missing
        // target then skips the step rather than wedging the tour.
      }
      if (cancelled || token !== runTokenRef.current) return;
      const el = await waitForAnchor(step, apiRef.current);
      if (cancelled || token !== runTokenRef.current) return;
      setAwaitingTarget(false);
      if (!el) {
        // Target never appeared: skip on the way the person was going. Going back, past it to the step before
        // (never onto the welcome card, which would start the tour over); else forward, finishing from the last.
        step.cleanup?.(apiRef.current);
        const before = steps[stepIndex - 1];
        if (stepDirRef.current === 'backward' && before && before.card !== 'welcome') {
          setStepIndex(stepIndex - 1);
        } else if (stepIndex < steps.length - 1) {
          setStepDir('forward');
          setStepIndex(stepIndex + 1);
        } else finishRef.current('completed');
        return;
      }
      adoptRef.current(step, el);
      revealInScrollers(el, step.revealAt);
      // Land on the target's resting rect, not mid-way through its own opening (a menu growing in, a panel
      // scrolling): the ring and the card glide there once, rather than chasing it.
      const rect = await settledRect(
        () => measureStep(el, step.alsoHighlight),
        [el, step.alsoHighlight ? findTour(step.alsoHighlight) : null],
      );
      if (cancelled || token !== runTokenRef.current) return;
      // Tracked only from here: tracked while it settled, the ring jumped to the target before the glide began.
      targetElRef.current = el;
      // What a step opened is shown, not typed into: a panel that focuses its own field on opening (a card's title)
      // would otherwise keep the tour's arrow keys for its cursor.
      const focused = document.activeElement;
      if (
        !step.keepFocus &&
        focused instanceof HTMLElement &&
        el.contains(focused) &&
        (focused.isContentEditable || focused.matches('input, textarea, select'))
      )
        focused.blur();
      setTargetRect(rect);
      setLandedIndex(stepIndex);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, apiRef, stepIndex, steps]);

  // Track the target while a step is showing: follow it when it moves and
  // re-run prepare when it disappears (a menu dismissed under the tour).
  // Paused while the tour has stepped aside, so nothing is reopened under the dialog; on its return the next tick heals
  // a target the dialog closed (an outside click dismissing a menu).
  useEffect(() => {
    if (!active || yielded) return;
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
        // A heal may reopen the tour's own dialog: the tour does not step aside for it.
        setAwaitingTarget(true);
        void (async () => {
          try {
            await step.prepare?.(apiRef.current);
            const next = await waitForAnchor(step, apiRef.current);
            if (token === runTokenRef.current) {
              targetElRef.current = next;
              if (next) {
                adoptRef.current(step, next);
                revealInScrollers(next, step.revealAt);
              }
              // Gone for good (a box deleted while its step is up): the ring lets go rather than framing nothing.
              setTargetRect(next ? measureStep(next, step.alsoHighlight) : null);
            }
          } finally {
            healingRef.current = false;
            if (token === runTokenRef.current) setAwaitingTarget(false);
          }
        })();
        return;
      }
      const r = measureStep(el, step.alsoHighlight);
      setTargetRect((prev) => (prev && rectsEqual(prev, r) ? prev : r));
    }, TRACK_MS);
    return () => window.clearInterval(id);
  }, [active, yielded, apiRef, stepIndex, steps]);

  const reset = () => {
    runTokenRef.current++;
    targetElRef.current = null;
    setTargetRect(null);
    setAwaitingTarget(false);
    setLandedIndex(null);
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
    // The dialogs open as it starts are its own (Show Me run from inside one); an offered tour waits for none.
    setModalBaseline(openModalCount());
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
    yielded,
    // The current step's target is found and showing (an anchorless card counts as soon as it is up). False between
    // steps and while a dismissed target is reopened.
    landed: active && landedIndex === stepIndex && !awaitingTarget,
    // The bookend cards sit outside the step count: "1 of N" is the first real step.
    countableSteps: steps.filter((s) => !s.card).length,
    // Whether the tour opens on a welcome card (an offered tour) or straight on its first step (Show Me).
    hasWelcome: steps[0]?.card === 'welcome',
    start,
    stop,
    next,
    back,
    skip,
  };
}

export type TourEngine<Api> = ReturnType<typeof useTourEngine<Api>>;
