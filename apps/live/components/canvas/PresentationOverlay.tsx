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

import { useCallback, useEffect, useState } from 'react';

import { slideName, type BoxedElement, type Slide, type Tab } from '@livediagram/diagram';

import {
  PresentationElementPopover,
  hasReadableDetail,
} from '@/components/canvas/PresentationElementPopover';
import { PresentationHud, usePointerIdle } from '@/components/canvas/PresentationHud';
import { PresentationSettings } from '@/components/canvas/PresentationSettings';
import type { PresentationConfig } from '@/lib/presentation-config';

export type PresentationStep = { slide: Slide; tab: Tab; index: number };

export function PresentationOverlay({
  steps,
  at,
  onGo,
  onExit,
  /** The direction the last move travelled, for the slide transition. */
  direction,
  config,
  onChangeConfig,
}: {
  steps: PresentationStep[];
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
  const [detail, setDetail] = useState<{ element: BoxedElement; x: number; y: number } | null>(
    null,
  );
  const atEnd = at >= steps.length;
  const step = atEnd ? undefined : steps[at];

  // The HUD stays put while a popover is open, or it would be left orphaned.
  const idle = usePointerIdle(true, notesOpen || settingsOpen || detail !== null);

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
        else if (settingsOpen) setSettingsOpen(false);
        else if (notesOpen) setNotesOpen(false);
        else onExit();
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
        setNotesOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [at, detail, go, notesOpen, onExit, settingsOpen, steps.length]);

  const onSurfaceClick = (e: React.MouseEvent) => {
    // Something open? Dismiss it. Reading must never cost a slide.
    if (detail) {
      setDetail(null);
      return;
    }
    if (notesOpen) {
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
          selected or pressed: read anything, change nothing. */}
      <div
        className="absolute inset-0 cursor-default"
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
          notesOpen={notesOpen}
          onToggleNotes={() => {
            setSettingsOpen(false);
            setNotesOpen((v) => !v);
          }}
          settingsOpen={settingsOpen}
          onToggleSettings={() => {
            setNotesOpen(false);
            setSettingsOpen((v) => !v);
          }}
          showPosition={config.showPosition}
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
