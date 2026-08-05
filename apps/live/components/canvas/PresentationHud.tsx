'use client';

// The presenter's HUD (spec/31): where you are in the deck, what the slide is
// called, your notes, and the way out.
//
// It fades out when the pointer is idle and returns on any pointer movement,
// so a still screen is clean for the room and every control is one twitch of
// the mouse away. It does NOT fade while the notes popover is open, or the
// popover would be left orphaned over the slide.

import { useEffect, useRef, useState } from 'react';

import { GearIcon } from '@/components/chrome/tab-bar-icons';

// How long the pointer must be still before the HUD gets out of the way.
const IDLE_MS = 2600;

/** Tracks pointer stillness. Exported for the overlay's own idle needs. */
export function usePointerIdle(enabled: boolean, holdVisible: boolean): boolean {
  const [idle, setIdle] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const wake = () => {
      setIdle(false);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    return () => {
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [enabled]);
  return idle && !holdVisible;
}

function HudButton({
  label,
  onPress,
  active,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        // Every HUD control stops the click: the surface underneath reads a
        // click as "advance", so pressing Back would go forward instead.
        e.stopPropagation();
        onPress();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`relative flex h-7 w-7 items-center justify-center rounded-md transition ${
        disabled
          ? 'cursor-default text-white/25'
          : active
            ? 'cursor-pointer bg-white/25 text-white'
            : 'cursor-pointer text-white/75 hover:bg-white/15 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * `m:ss`, counting up. Minutes are not padded (a talk is "7:04", not "07:04")
 * and hours are left to roll past 60 — a deck running that long has bigger
 * problems than its clock's format.
 */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function PresentationHud({
  position,
  total,
  name,
  notes,
  notesOpen,
  onToggleNotes,
  settingsOpen,
  onToggleSettings,
  showPosition,
  elapsedMs,
  budget,
  onBack,
  onNext,
  onClose,
  hidden,
}: {
  /** 1-based. */
  position: number;
  total: number;
  name: string;
  notes: string | undefined;
  notesOpen: boolean;
  onToggleNotes: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  /** The presenter can turn the counter off from the cog. */
  showPosition: boolean;
  /** Milliseconds since Start, or null when the clock is switched off. */
  elapsedMs: number | null;
  /** This slide's budget in minutes, and the time spent on it. Null = no readout. */
  budget: { minutes: number; onSlideMs: number } | null;
  /** Absent on the first slide, so the control disables rather than lying. */
  onBack?: () => void;
  onNext: () => void;
  onClose: () => void;
  hidden: boolean;
}) {
  const hasNotes = (notes ?? '').trim().length > 0;
  return (
    <>
      <div
        className={`pointer-events-auto fixed right-4 top-4 z-[65] flex items-center gap-2 rounded-xl bg-slate-900/70 px-3 py-1.5 backdrop-blur transition-opacity duration-300 ${
          hidden ? 'opacity-0' : 'opacity-100'
        }`}
        // Hidden means hidden: an invisible HUD must not eat a click meant for
        // the slide underneath it.
        style={{ pointerEvents: hidden ? 'none' : 'auto' }}
      >
        {showPosition ? (
          <>
            <span className="select-none text-[11px] font-semibold tabular-nums text-white/90">
              {position} / {total}
            </span>
            <span className="max-w-[14rem] select-none truncate text-[11px] text-white/60">
              {name}
            </span>
          </>
        ) : null}
        {/* Pacing (spec/31). Both off by default and both the presenter's, not
            the diagram's. The budget is a TARGET: going over is marked, never
            enforced, because a deck that advanced itself mid-answer would be
            worse than no budget at all. */}
        {elapsedMs !== null ? (
          <span
            className="select-none text-[11px] font-semibold tabular-nums text-white/70"
            title="Time since the presentation started"
          >
            {formatElapsed(elapsedMs)}
          </span>
        ) : null}
        {budget ? (
          <span
            className={`select-none rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              budget.onSlideMs > budget.minutes * 60_000
                ? 'bg-amber-400/20 text-amber-200'
                : 'text-white/70'
            }`}
            title={`This slide is budgeted ${budget.minutes} min`}
          >
            {formatElapsed(budget.onSlideMs)} / {budget.minutes}:00
          </span>
        ) : null}
        {/* Step through the deck by pointer as well as by key. A presenter on
            a projector often has a mouse and no keyboard within reach, and
            "click anywhere to advance" is not discoverable and cannot go
            BACK at all. */}
        <HudButton label="Previous slide" onPress={() => onBack?.()} disabled={!onBack}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
        </HudButton>
        <HudButton label="Next slide" onPress={onNext}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </HudButton>
        {/* Only when this slide HAS a script. A permanent button that opens an
            empty card is a control that lies about there being something to
            read; its absence says "nothing to say here" faster than any dot
            could. The dot it used to carry is gone with it — the button's
            presence IS the signal now. */}
        {hasNotes ? (
          <HudButton label="Presenter notes" onPress={onToggleNotes} active={notesOpen}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden
            >
              <rect x="2.5" y="2" width="11" height="12" rx="1.6" />
              <path d="M5 5.5h6M5 8h6M5 10.5h3.5" />
            </svg>
          </HudButton>
        ) : null}
        {/* The app's own settings glyph, not a cog. A cog's spokes around a
            central circle read as a SUN at this size — which is exactly why it
            was replaced everywhere else (see GearIcon), and doubly wrong on a
            dark HUD where the stroke is light. */}
        <HudButton label="Presentation settings" onPress={onToggleSettings} active={settingsOpen}>
          <GearIcon />
        </HudButton>
        <HudButton label="Exit presentation" onPress={onClose}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </HudButton>
      </div>

      {notesOpen ? (
        <div
          role="dialog"
          aria-label="Presenter notes"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto fixed right-4 top-16 z-[66] max-h-[50vh] w-80 overflow-y-auto rounded-xl bg-slate-900/90 p-3 text-[12px] leading-relaxed text-white/85 shadow-2xl backdrop-blur"
        >
          {hasNotes ? (
            <p className="whitespace-pre-wrap">{notes}</p>
          ) : (
            <p className="italic text-white/45">No notes for this slide.</p>
          )}
        </div>
      ) : null}
    </>
  );
}
