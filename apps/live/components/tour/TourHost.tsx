'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createShape, isBoxed, type Element } from '@livediagram/diagram';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';
import { Portal } from '@/components/primitives/Portal';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import {
  clearTourPending,
  hasTourPending,
  markTourPending,
  TOUR_RELAUNCH_EVENT,
} from '@/lib/tour-pending';
import { track } from '@/lib/telemetry';
import { deriveNewBoxedColours } from '@/lib/themes';
import { computeViewportCenter } from '@/lib/viewport';
import { findTour, waitForSelector, waitForTour } from './tour-dom';
import { TOUR_STEPS, tourStepTelemetryType, type TourApi } from './tour-steps';
import { TourPopover } from './TourPopover';

// Orchestrates the interactive editor tour (spec/79). Mounted once in
// EditorView; renders nothing until either the /new handoff flag is
// consumed (a brand-new user's first diagram → the welcome offer card) or
// the Settings dialog requests a relaunch. Each step runs prepare (opening
// the real panel / dropdown / menu it explains), waits for its target
// node, then renders a dimming highlight ring plus the step popover
// anchored to it. A watcher re-measures the target every 150ms so the
// highlight tracks layout changes, and re-runs prepare if the target is
// dismissed mid-step (an outside click closing a menu). The last rect is
// kept while the next step prepares, so the ring GLIDES between targets
// (transition-all) instead of blinking out and back.

// Plain rect (not DOMRect): dropdown steps highlight the UNION of the
// trigger and its portalled menu, which getBoundingClientRect can't hand
// us directly.
export type TourTargetRect = { left: number; top: number; width: number; height: number };

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

export function TourHost() {
  const ctx = useEditorContext();
  const isMobile = useIsMobileViewport();
  // The effective step list: mobile drops the desktop-only steps (search).
  const steps = useMemo(() => TOUR_STEPS.filter((s) => !(s.mobileSkip && isMobile)), [isMobile]);
  const [pending, setPending] = useState(false);
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
  // endTour, reachable from the step-run effect without depending on its
  // per-render identity (assigned below, after its definition).
  const endTourRef = useRef<(outcome: 'TourCompleted' | 'TourSkipped' | 'TourDeclined') => void>(
    () => {},
  );

  // The step API is rebuilt every render through a ref so step callbacks
  // always see fresh editor-context handlers (never stale closures).
  const apiRef = useRef<TourApi>(null as unknown as TourApi);
  apiRef.current = {
    compact: isMobile || ctx.userPreferences?.minimalPanels === true,
    openElementContextMenu: async () => {
      // Reuse the first boxed element (template diagrams come populated);
      // add a theme-coloured square at the viewport centre when empty.
      let elementId = ctx.activeTab.elements.find(isBoxed)?.id ?? null;
      if (!elementId) {
        const base = createShape('square', 0, 0);
        const colours = deriveNewBoxedColours(base, {
          backgroundColor: ctx.activeTab.backgroundColor,
          patternColor: ctx.activeTab.patternColor,
          theme: ctx.activeTab.theme,
        });
        const hostRect = ctx.canvasMainRef.current?.getBoundingClientRect();
        const centre = hostRect
          ? computeViewportCenter(hostRect, ctx.viewportOffset)
          : { x: 400, y: 300 };
        const el: Element = {
          ...base,
          ...colours,
          x: centre.x - base.width / 2,
          y: centre.y - base.height / 2,
        };
        // Single-undo-block append via the AI merge path: fresh id, so it
        // lands as a plain add.
        ctx.applyAiElements([el], 'generate');
        elementId = el.id;
      }
      ctx.setSelectedId(elementId);
      const node = await waitForSelector(`[data-element-id="${elementId}"]`, 2000);
      const r = node?.getBoundingClientRect();
      // Open beside the element; the menu clamps itself into the viewport.
      ctx.setContextMenu({
        mode: 'element',
        elementId,
        x: r ? r.right + 10 : window.innerWidth / 2,
        y: r ? Math.max(12, r.top) : window.innerHeight / 3,
      });
    },
    closeContextMenu: () => ctx.closeContextMenu(),
    openSearchPanel: () => ctx.setSearchOpen(true),
    closeSearchPanel: () => ctx.setSearchOpen(false),
  };

  // Peek at the /new handoff flag (NOT consume: it stays set until the
  // offer is resolved, so a reload mid-offer or mid-tour re-offers instead
  // of silently swallowing the tour), then wait for the editor to be
  // usable before offering (the small delay lets the fit-to-screen pass
  // and panel layout settle). The `tourSeen` preference (synced, spec/20)
  // makes the offer once-ever for the user, however it was dismissed —
  // checked again at fire time below in case the preferences fetch lands
  // after mount.
  useEffect(() => {
    if (hasTourPending()) setPending(true);
  }, []);
  const seen = ctx.userPreferences?.tourSeen === true;
  const ready = ctx.hydrated && !ctx.anyWelcomeOpen && !ctx.isReadOnly && !ctx.embedMode;
  useEffect(() => {
    if (!pending || active || !ready) return;
    if (seen) {
      // Resolved elsewhere (another tab / device): tidy the stale flag.
      clearTourPending();
      setPending(false);
      return;
    }
    const t = setTimeout(() => {
      setPending(false);
      setStepIndex(0);
      setStepDir('forward');
      setActive(true);
      track('UI', 'Opened', 'TourOffer');
    }, 800);
    return () => clearTimeout(t);
  }, [pending, active, ready, seen]);

  // Settings relaunch (the "I've seen the editor tour" row, unchecked +
  // closed): rerun from the top — the welcome card is always step 1. Also
  // re-marks the pending flag so a reload mid-rerun re-offers, exactly
  // like the first-run path.
  useEffect(() => {
    const onRelaunch = () => {
      if (!ready) return;
      markTourPending();
      runTokenRef.current++;
      targetElRef.current = null;
      setTargetRect(null);
      setStepIndex(0);
      setStepDir('forward');
      setActive(true);
      track('UI', 'Opened', 'TourOffer');
    };
    window.addEventListener(TOUR_RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(TOUR_RELAUNCH_EVENT, onRelaunch);
  }, [ready]);

  // The step list can SHRINK mid-tour (crossing the mobile breakpoint
  // drops the desktop-only steps): clamp the index so the effects and
  // render below never read past the end (steps[stepIndex] would be
  // undefined and the sync .target access threw before this guard).
  useEffect(() => {
    if (stepIndex > steps.length - 1) setStepIndex(steps.length - 1);
  }, [steps, stepIndex]);

  // Run the current step: prepare, then await the target node. The
  // previous step's rect stays on screen meanwhile, so the ring glides to
  // the new target when it lands.
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIndex];
    if (!step) return; // shrunk list; the clamp effect is about to fix the index
    // Stage-view funnel (spec/22): one event per step entry (Back re-entry
    // included — it's a real view). The welcome card's view is already
    // covered by Opened/TourOffer; the last View before an
    // Ended/TourSkipped marks the drop-off stage on the dashboard.
    if (step.card !== 'welcome') track('UI', 'View', tourStepTelemetryType(step.id));
    const token = ++runTokenRef.current;
    let cancelled = false;
    void (async () => {
      if (!step.target) {
        // Anchorless (welcome / outro) card: centred, no highlight.
        targetElRef.current = null;
        setTargetRect(null);
        return;
      }
      try {
        await step.prepare?.(apiRef.current);
      } catch {
        // A failed prepare falls through to the target wait; a missing
        // target then skips the step rather than wedging the tour.
      }
      const el = await waitForTour(step.target, 3500);
      if (cancelled || token !== runTokenRef.current) return;
      if (!el) {
        // Target never appeared: skip forward (or finish from the last
        // step). endTour is reached through a ref so this effect doesn't
        // depend on its per-render identity (restarting the step run on
        // unrelated renders).
        step.cleanup?.(apiRef.current);
        if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
        else endTourRef.current('TourCompleted');
        return;
      }
      targetElRef.current = el;
      setTargetRect(measureStep(el, step.alsoHighlight));
    })();
    return () => {
      cancelled = true;
    };
  }, [active, stepIndex, steps]);

  // Track the target while a step is showing: follow it when it moves and
  // re-run prepare when it disappears (a menu dismissed under the tour).
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIndex];
    if (!step?.target) return;
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
            const next = await waitForTour(step.target!, 3500);
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
    }, 150);
    return () => window.clearInterval(id);
  }, [active, stepIndex, steps]);

  const endTour = (outcome: 'TourCompleted' | 'TourSkipped' | 'TourDeclined') => {
    runTokenRef.current++;
    targetElRef.current = null;
    setTargetRect(null);
    setActive(false);
    // Safety net beyond the current step's cleanup: never strand an open
    // menu; and never offer again, however the tour ended — via the synced
    // tourSeen preference (spec/20), so it holds across the user's devices.
    // The offer is now RESOLVED, so the reload-surviving pending flag can
    // finally go.
    apiRef.current.closeContextMenu();
    clearTourPending();
    const next = { ...ctx.userPreferences, tourSeen: true };
    ctx.setUserPreferences(next);
    ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
    if (outcome === 'TourDeclined') track('UI', 'Closed', 'TourOffer');
    else track('UI', 'Ended', outcome);
  };
  endTourRef.current = endTour;

  if (!active) return null;
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  if (!step) return null;
  // The bookend cards sit outside the step count: "1 of N" is the palette.
  const countableSteps = steps.filter((s) => !s.card).length;
  const leaveStep = () => {
    runTokenRef.current++;
    targetElRef.current = null;
    step.cleanup?.(apiRef.current);
  };
  const onNext = () => {
    leaveStep();
    if (step.card === 'welcome') track('UI', 'Started', 'Tour');
    setStepDir('forward');
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
    else endTour('TourCompleted');
  };
  const onBack = () => {
    leaveStep();
    setStepDir('backward');
    setStepIndex(stepIndex - 1);
  };
  const onSkip = () => {
    leaveStep();
    endTour(step.card === 'welcome' ? 'TourDeclined' : 'TourSkipped');
  };

  return (
    <Portal>
      {step.card ? (
        // Focus backdrop for the bookend cards: a SUBTLE full-screen tint
        // (much lighter than Dialog's — the canvas should stay visible)
        // that draws the eye to the card and absorbs stray clicks until
        // it's answered. Deliberately NOT a click-to-dismiss surface —
        // with the once-ever done-guard, a stray backdrop click must
        // never count as a permanent decline.
        <div
          aria-hidden
          className="fixed inset-0 z-[var(--z-overlay)] animate-fade-in bg-slate-900/15 dark:bg-slate-950/25"
        />
      ) : null}
      {targetRect ? (
        // The spotlight: a ring around the target whose giant box-shadow
        // dims everything else. pointer-events-none so the user can still
        // interact with whatever is highlighted; portalled menus (higher
        // z / later portals) paint above the dim. transition-all makes it
        // glide when the rect moves between steps; fade-in covers its
        // first appearance. Targets that bring their own modal backdrop
        // (the search panel) lift the ring above the modal layer.
        <div
          aria-hidden
          className={`pointer-events-none fixed animate-fade-in rounded-xl border-2 border-brand-400 transition-all duration-300 ease-out dark:border-brand-500 ${
            step.ringAboveModal ? 'z-[var(--z-popover)]' : 'z-[var(--z-overlay)]'
          }`}
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: '0 0 0 100vmax rgba(15, 23, 42, 0.4)',
          }}
        />
      ) : null}
      <TourPopover
        // The bookend cards have no number; real steps count from 1
        // (welcome occupies index 0, so a step's index IS its number).
        stepNumber={step.card ? 0 : stepIndex}
        stepCount={countableSteps}
        stepId={step.id}
        stepDir={stepDir}
        card={step.card}
        title={step.title}
        body={step.body}
        targetRect={targetRect}
        onBack={stepIndex > 1 && !step.card ? onBack : undefined}
        onNext={onNext}
        onSkip={onSkip}
      />
    </Portal>
  );
}

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
