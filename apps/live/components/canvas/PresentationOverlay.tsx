'use client';

// The full-screen surface Start puts you into (spec/31).
//
// The SLIDE is drawn by the real canvas underneath this, not by anything here:
// a slide has to respond to clicks and carry live element state, which an SVG
// or raster snapshot cannot do, and there is then exactly one thing that knows
// how an element looks. This layer owns everything around the slide — the
// click routing, the keyboard, the HUD, the notes, the element popover and the
// end state — plus the darkened frame the deck sits in.
//
// Click routing is the subtle part. Click-to-advance and click-to-inspect are
// the SAME gesture on different targets, and the canvas is underneath a
// full-screen catcher, so the catcher asks `document.elementsFromPoint` what
// was actually under the pointer: an element opens its popover, empty space
// advances. A click while a popover is open dismisses it rather than
// advancing, so reading a note never costs you a slide.

import { useCallback, useEffect, useRef, useState } from 'react';
import { announce } from '@/lib/announcer';

import { slideName, type BoxedElement, type Slide, type Tab } from '@livediagram/diagram';

import {
  PresentationElementPopover,
  hasReadableDetail,
} from '@/components/canvas/PresentationElementPopover';
import { PresentationHud, usePointerIdle } from '@/components/canvas/PresentationHud';
import { track } from '@/lib/telemetry';
import { PresentationSettings } from '@/components/canvas/PresentationSettings';
import type { PresentationConfig } from '@/lib/presentation-config';

export type PresentationStep = { slide: Slide; tab: Tab; index: number };

export function PresentationOverlay({
  steps,
  canvasTool,
  onSetCanvasTool,
  at,
  onGo,
  onExit,
  /** The direction the last move travelled, for the slide transition. */
  direction,
  config,
  onChangeConfig,
}: {
  steps: PresentationStep[];
  /**
   * The live canvas tool, so the pointing tools can be armed from the deck.
   * Laser and Spotlight are the only two reachable here — see the catcher.
   */
  canvasTool: string;
  onSetCanvasTool: (tool: 'laser' | 'spotlight' | 'select') => void;
  /** Index into `steps`, or steps.length for the end state. */
  at: number;
  onGo: (next: number) => void;
  onExit: () => void;
  direction: 'forward' | 'back';
  config: PresentationConfig;
  onChangeConfig: (patch: Partial<PresentationConfig>) => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [detail, setDetail] = useState<{ element: BoxedElement; x: number; y: number } | null>(
    null,
  );
  // Armed pointing tool: the catcher stands down for these two and only these
  // two, so nothing else can reach the canvas.
  const pointing = canvasTool === 'laser' || canvasTool === 'spotlight';
  const atEnd = at >= steps.length;
  const step = atEnd ? undefined : steps[at];

  // The HUD stays put while a popover is open, or it would be left orphaned.
  // A slide with no script cannot have its notes open: advancing onto one
  // would otherwise leave an empty card sitting over the slide.
  const slideHasNotes = (step?.slide.notes ?? '').trim().length > 0;
  const notesVisible = notesOpen && slideHasNotes;

  const idle =
    usePointerIdle(true, notesVisible || settingsOpen || jumpOpen || detail !== null) &&
    !config.keepControls;

  // Publish idleness so the CSS can hide the cursor with the same signal that
  // fades the HUD — the two must come back together, or a hidden pointer would
  // be a trap.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-pointer-idle', idle);
    return () => document.documentElement.removeAttribute('data-pointer-idle');
  }, [idle]);

  const go = useCallback(
    (next: number) => {
      // Advancing closes what is open, so the next slide starts clean.
      setNotesOpen(false);
      setSettingsOpen(false);
      setDetail(null);
      if (next < 0) return;
      // Looping (a cog setting) turns the end of the deck back into the start
      // instead of the end state, for a deck left running in a room.
      if (config.loop && next >= steps.length) {
        onGo(0);
        return;
      }
      if (next > steps.length) {
        onExit();
        return;
      }
      onGo(next);
    },
    [config.loop, onExit, onGo, steps.length],
  );

  // Auto-advance, for a deck left running in a room. Paused while anything is
  // open, because a popover the presenter is reading must not be swept away by
  // a timer they had forgotten about.
  useEffect(() => {
    const seconds = config.autoAdvanceSeconds;
    if (seconds <= 0 || atEnd || notesOpen || settingsOpen || detail) return;
    const id = window.setTimeout(() => go(at + 1), seconds * 1000);
    return () => window.clearTimeout(id);
  }, [at, atEnd, config.autoAdvanceSeconds, detail, go, notesOpen, settingsOpen]);

  // Browser fullscreen where available. Best-effort: it needs a user gesture
  // and can be refused, and the overlay is already full-viewport either way,
  // so a refusal costs nothing.
  useEffect(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement) void el.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Pacing (spec/31). One ticking value drives both readouts, and it only
  // ticks when something is actually being shown: a deck with the clock and
  // the budget both off must not re-render once a second for nothing.
  //
  // Wall-clock marks rather than accumulated counters, so a tab that was
  // backgrounded (and had its timers throttled) still reports the real time
  // spent rather than the number of ticks that happened to fire.
  const [startedAt] = useState(() => Date.now());
  const [slideEnteredAt, setSlideEnteredAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const slideMinutes = step?.slide.minutes;
  const wantsClock = config.showElapsed || (config.showBudget && !!slideMinutes);
  useEffect(() => setSlideEnteredAt(Date.now()), [at]);
  useEffect(() => {
    if (!wantsClock) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [wantsClock]);

  // Say the slide out loud for a screen reader (spec/71's announcer). The deck
  // is otherwise an entirely visual surface: driven by the arrow keys, nothing
  // reports that anything changed.
  //
  // Through the shared announcer rather than a live region of our own. The
  // canvas underneath already mounts one (CanvasLiveRegion) and it stays
  // mounted while presenting, so a second would be two regions competing to
  // speak over each other.
  useEffect(() => {
    if (atEnd) {
      announce('End of deck');
      return;
    }
    const slide = steps[at]?.slide;
    if (!slide) return;
    const name = (slide.name ?? '').trim();
    announce(`Slide ${at + 1} of ${steps.length}${name ? `, ${name}` : ''}`);
  }, [at, atEnd, steps]);

  // Give the tool back on the way out. Exiting already restores the tab, the
  // viewport and the chrome (spec/31); a presenter who armed the laser for one
  // slide should not land back in the editor still holding it.
  //
  // The ref is read at cleanup only, so remembering the tool at Start costs
  // nothing while the deck runs.
  const toolAtStart = useRef(canvasTool);
  useEffect(() => {
    const before = toolAtStart.current;
    return () => {
      if (before === 'laser' || before === 'spotlight') return;
      onSetCanvasTool('select');
    };
    // Deliberately once: this is Start and Exit, not every tool change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the screen awake for the run (spec/31). A slide you talk over for five
  // minutes is a slide the laptop dims, and a presenter waking their own screen
  // mid-sentence is a small indignity a deck should not cause.
  //
  // Best-effort like fullscreen above: the API is absent on some browsers and
  // the request can be refused, and the deck runs exactly the same either way.
  // The lock is re-taken on visibilitychange because the browser drops it
  // whenever the tab is hidden — switching away and back would otherwise leave
  // the rest of the talk unprotected.
  useEffect(() => {
    type WakeLockSentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
    };
    if (!nav.wakeLock) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      void nav.wakeLock
        ?.request('screen')
        .then((s) => {
          if (cancelled) void s.release().catch(() => {});
          else sentinel = s;
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Capture phase and always consumed: the editor's own shortcuts must not
      // fire underneath a presentation.
      const key = e.key;
      const handled = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (key === 'Escape') {
        handled();
        if (detail) setDetail(null);
        else if (jumpOpen) setJumpOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (notesOpen) setNotesOpen(false);
        else onExit();
        return;
      }
      // The pointing tools (spec/31). Neither touches the diagram, and the
      // laser was built for exactly this room — spec/111 opens by calling it
      // "the presenting tool". Pressing the same key again puts the pointer
      // back, so arming one is never a trap.
      if (key === 'l' || key === 'L') {
        handled();
        onSetCanvasTool(canvasTool === 'laser' ? 'select' : 'laser');
        return;
      }
      if (key === 's' || key === 'S') {
        handled();
        onSetCanvasTool(canvasTool === 'spotlight' ? 'select' : 'spotlight');
        return;
      }
      if (key === 'g' || key === 'G') {
        handled();
        setJumpOpen((v) => !v);
        return;
      }
      if (key === 'ArrowRight' || key === ' ' || key === 'PageDown' || key === 'Enter') {
        handled();
        go(at + 1);
        return;
      }
      if (key === 'ArrowLeft' || key === 'PageUp') {
        handled();
        go(Math.max(0, at - 1));
        return;
      }
      if (key === 'Home') {
        handled();
        go(0);
        return;
      }
      if (key === 'End') {
        handled();
        go(Math.max(0, steps.length - 1));
        return;
      }
      if (key === 'n' || key === 'N') {
        handled();
        // Same rule as the button: a slide with no script has nothing to open,
        // so the key is inert rather than raising an empty card.
        if (!step?.slide.notes?.trim()) return;
        setNotesOpen((v) => {
          if (!v) track('UI', 'Opened', 'PresenterNotes');
          return !v;
        });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [at, detail, go, notesOpen, onExit, settingsOpen, step, steps.length]);

  const onSurfaceClick = (e: React.MouseEvent) => {
    // Something open? Dismiss it. Reading must never cost a slide.
    if (detail) {
      setDetail(null);
      return;
    }
    if (notesVisible) {
      setNotesOpen(false);
      return;
    }
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    if (atEnd) {
      onExit();
      return;
    }
    // elementsFromPoint, not the event target: this catcher sits ON TOP of the
    // canvas, so the target is always the catcher. The list underneath is what
    // says whether an element was clicked.
    const under = document.elementsFromPoint(e.clientX, e.clientY);
    const hit = under.find((node) => node.hasAttribute?.('data-element-id'));
    const id = hit?.getAttribute('data-element-id');
    if (id && step) {
      const element = step.tab.elements.find((el) => el.id === id);
      if (element && hasReadableDetail(element)) {
        setDetail({ element, x: e.clientX, y: e.clientY });
        // Does anybody use "read anything, change nothing"? This is the whole
        // question the rule was written to answer.
        track('UI', 'Opened', 'SlideElementDetail');
        return;
      }
    }
    // Click-to-advance is a cog setting: a presenter who gestures at the
    // screen with the mouse can turn it off and drive from the keys alone.
    if (config.advanceOnClick) go(at + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[60]"
      // The slide itself is the canvas underneath; this is the frame around it.
      data-presentation-surface=""
    >
      {/* Click catcher. Covers the canvas so no element can be dragged,
          selected or pressed: read anything, change nothing.
          
          It steps aside entirely while a POINTING tool is armed. The laser and
          the spotlight need the pointer on the canvas to work at all, and
          neither can change the diagram — they are the two tools whose whole
          job is to point at it. The cost is that click-to-advance goes with the
          catcher, which is the right trade: while you are drawing a laser
          stroke a click means "point", not "next slide". The keys and the HUD
          buttons still advance. */}
      <div
        className={`absolute inset-0 cursor-default ${pointing ? 'pointer-events-none' : ''}`}
        onClick={onSurfaceClick}
        // Swallowed so nothing underneath ever begins a gesture.
        onPointerDown={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        aria-hidden
      />

      {atEnd ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-sm font-semibold text-white/90">End of the deck</span>
            <span className="text-[11px] text-white/50">
              Click, press Space, or hit Esc to go back to the diagram.
            </span>
          </div>
        </div>
      ) : null}

      {step ? (
        <PresentationHud
          position={at + 1}
          total={steps.length}
          name={slideName(step.slide, step.index)}
          notes={step.slide.notes}
          notesOpen={notesVisible}
          onToggleNotes={() => {
            setSettingsOpen(false);
            setNotesOpen((v) => {
              if (!v) track('UI', 'Opened', 'PresenterNotes');
              return !v;
            });
          }}
          settingsOpen={settingsOpen}
          onToggleSettings={() => {
            setNotesOpen(false);
            setSettingsOpen((v) => {
              if (!v) track('UI', 'Opened', 'PresentationSettings');
              return !v;
            });
          }}
          showPosition={config.showPosition}
          slides={steps.map((st, i) => ({
            id: st.slide.id,
            label: (st.slide.name ?? '').trim() || `Slide ${i + 1}`,
          }))}
          jumpOpen={jumpOpen}
          onToggleJump={() => setJumpOpen((v) => !v)}
          onJump={(i) => {
            setJumpOpen(false);
            go(i);
          }}
          elapsedMs={config.showElapsed ? now - startedAt : null}
          budget={
            config.showBudget && slideMinutes
              ? { minutes: slideMinutes, onSlideMs: now - slideEnteredAt }
              : null
          }
          onBack={at > 0 ? () => go(at - 1) : undefined}
          onNext={() => go(at + 1)}
          onClose={onExit}
          hidden={idle}
        />
      ) : null}

      {settingsOpen ? <PresentationSettings config={config} onChange={onChangeConfig} /> : null}

      {detail ? (
        <PresentationElementPopover
          element={detail.element}
          at={{ x: detail.x, y: detail.y }}
          onClose={() => setDetail(null)}
        />
      ) : null}

      {/* Direction is carried on the surface so the canvas underneath can pick
          its transition class (see globals.css) without knowing about slides. */}
      <span hidden data-presentation-direction={direction} />
    </div>
  );
}
