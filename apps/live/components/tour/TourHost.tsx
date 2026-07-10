'use client';

import { useEffect, useRef, useState } from 'react';
import { createShape, isBoxed, type Element } from '@livediagram/diagram';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';
import { Portal } from '@/components/primitives/Portal';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { consumeTourPending } from '@/lib/tour-pending';
import { track } from '@/lib/telemetry';
import { deriveNewBoxedColours } from '@/lib/themes';
import { computeViewportCenter } from '@/lib/viewport';
import { waitForSelector, waitForTour } from './tour-dom';
import { TOUR_STEPS, type TourApi } from './tour-steps';
import { TourPopover } from './TourPopover';

// Orchestrates the interactive editor tour (spec/79). Mounted once in
// EditorView; renders nothing until the /new wizard's "Show me around"
// handoff flag is consumed and the editor is actually usable. Each step
// runs prepare (opening the real panel / dropdown / menu it explains),
// waits for its target node, then renders a dimming highlight ring plus
// the step popover anchored to it. A watcher re-measures the target every
// 150ms so the highlight tracks layout changes, and re-runs prepare if the
// target is dismissed mid-step (an outside click closing a menu).

const rectsEqual = (a: DOMRect, b: DOMRect) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

export function TourHost() {
  const ctx = useEditorContext();
  const isMobile = useIsMobileViewport();
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const targetElRef = useRef<HTMLElement | null>(null);
  // Monotonic token: bumping it invalidates any in-flight async step run
  // (prepare + waits) so a fast Next/Next can't land a stale target.
  const runTokenRef = useRef(0);
  const healingRef = useRef(false);

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
  };

  // Consume the /new handoff flag once, then wait for the editor to be
  // usable before starting (the small delay lets the fit-to-screen pass
  // and panel layout settle so step 1 highlights a stable palette).
  useEffect(() => {
    if (consumeTourPending()) setPending(true);
  }, []);
  const ready = ctx.hydrated && !ctx.anyWelcomeOpen && !ctx.isReadOnly && !ctx.embedMode;
  useEffect(() => {
    if (!pending || active || !ready) return;
    const t = setTimeout(() => {
      setPending(false);
      setStepIndex(0);
      setActive(true);
      track('UI', 'Started', 'Tour');
    }, 800);
    return () => clearTimeout(t);
  }, [pending, active, ready]);

  // Run the current step: prepare, then await the target node.
  useEffect(() => {
    if (!active) return;
    const token = ++runTokenRef.current;
    const step = TOUR_STEPS[stepIndex]!;
    let cancelled = false;
    void (async () => {
      try {
        await step.prepare?.(apiRef.current);
      } catch {
        // A failed prepare falls through to the target wait; a missing
        // target then skips the step rather than wedging the tour.
      }
      const el = await waitForTour(step.target, 3500);
      if (cancelled || token !== runTokenRef.current) return;
      if (!el) {
        // Target never appeared: skip forward (or finish from the last step).
        step.cleanup?.(apiRef.current);
        if (stepIndex < TOUR_STEPS.length - 1) setStepIndex(stepIndex + 1);
        else endTour('TourCompleted');
        return;
      }
      targetElRef.current = el;
      setTargetRect(el.getBoundingClientRect());
    })();
    return () => {
      cancelled = true;
    };
  }, [active, stepIndex]);

  // Track the target while a step is showing: follow it when it moves and
  // re-run prepare when it disappears (a menu dismissed under the tour).
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      const el = targetElRef.current;
      if (!el) return;
      if (!el.isConnected) {
        if (healingRef.current) return;
        healingRef.current = true;
        targetElRef.current = null;
        const token = ++runTokenRef.current;
        const step = TOUR_STEPS[stepIndex]!;
        void (async () => {
          try {
            await step.prepare?.(apiRef.current);
            const next = await waitForTour(step.target, 3500);
            if (token === runTokenRef.current && next) {
              targetElRef.current = next;
              setTargetRect(next.getBoundingClientRect());
            }
          } finally {
            healingRef.current = false;
          }
        })();
        return;
      }
      const r = el.getBoundingClientRect();
      setTargetRect((prev) => (prev && rectsEqual(prev, r) ? prev : r));
    }, 150);
    return () => window.clearInterval(id);
  }, [active, stepIndex]);

  const endTour = (outcome: 'TourCompleted' | 'TourSkipped') => {
    runTokenRef.current++;
    targetElRef.current = null;
    setTargetRect(null);
    setActive(false);
    // Safety net beyond the current step's cleanup: never strand an open
    // menu or a dock popover when the tour ends.
    apiRef.current.closeContextMenu();
    track('UI', 'Ended', outcome);
  };

  if (!active) return null;
  const step = TOUR_STEPS[stepIndex]!;
  const leaveStep = () => {
    runTokenRef.current++;
    targetElRef.current = null;
    setTargetRect(null);
    step.cleanup?.(apiRef.current);
  };
  const onNext = () => {
    leaveStep();
    if (stepIndex < TOUR_STEPS.length - 1) setStepIndex(stepIndex + 1);
    else endTour('TourCompleted');
  };
  const onBack = () => {
    leaveStep();
    setStepIndex(stepIndex - 1);
  };
  const onSkip = () => {
    leaveStep();
    endTour('TourSkipped');
  };

  return (
    <Portal>
      {targetRect ? (
        // The spotlight: a ring around the target whose giant box-shadow
        // dims everything else. pointer-events-none so the user can still
        // interact with whatever is highlighted; portalled menus (higher
        // z / later portals) paint above the dim.
        <div
          aria-hidden
          className="pointer-events-none fixed z-[var(--z-overlay)] rounded-xl border-2 border-brand-400 transition-all duration-200 dark:border-brand-500"
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
        stepNumber={stepIndex + 1}
        stepCount={TOUR_STEPS.length}
        title={step.title}
        body={step.body}
        targetRect={targetRect}
        onBack={stepIndex > 0 ? onBack : undefined}
        onNext={onNext}
        onSkip={onSkip}
      />
    </Portal>
  );
}
