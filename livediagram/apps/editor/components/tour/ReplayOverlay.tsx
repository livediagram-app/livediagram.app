'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  lucideCheck,
  lucideChevronRight,
  lucidePause,
  lucidePlay,
  lucideRotateCcw,
} from '@liveworkspace/icons/lucide';
import { identityVars, lucideGlyph, SOLID_BRAND_DARK_CONTROL, Tooltip } from '@livediagram/ui';
import { RemoteCursor } from '@liveworkspace/workbench/components/canvas/RemoteCursor';
import type { Chapter } from '@/lib/replay/topic';
import { playerPlace, useCanvasBox } from './use-canvas-box';

// `pressing`: a press is landing (one ripple). `holding`: Example is holding something (a carry, a pen down).
export type ReplayCursor = { x: number; y: number; pressing: boolean; holding?: boolean };

// The play button's face for each thing it does.
const TOGGLE_GLYPH = {
  play: lucideGlyph(lucidePlay, 14),
  pause: lucideGlyph(lucidePause, 14),
  replay: lucideGlyph(lucideRotateCcw, 14),
  next: lucideGlyph(lucideChevronRight, 16),
  done: lucideGlyph(lucideCheck, 14),
} as const;

// Example's colour: a collaborator's rose, so the cursor reads as a person in the room.
const EXAMPLE_COLOUR = '#e11d48';

// Watch It Built's chrome (docs/specs/007-editor/watch-it-built.md "The replay", "The player"): the player, with
// Example's line, and Example. Portalled above the tour shield, so only these take presses.
export function ReplayOverlay({
  title,
  chapters,
  index,
  ms,
  playing,
  finished,
  reduced,
  touch,
  menuOpen,
  say,
  cursor,
  canvasRef,
  onToggle,
  onChapter,
  onYourTurn,
  onMore,
}: {
  // The topic's name, the player's accessible name.
  title: string;
  chapters: readonly Chapter[];
  index: number;
  ms: number;
  playing: boolean;
  finished: boolean;
  reduced: boolean;
  touch: boolean;
  // The element menu is open: on a phone it is a sheet up from the bottom, so the player moves to the top.
  menuOpen: boolean;
  say: string;
  cursor: ReplayCursor | null;
  canvasRef: RefObject<HTMLElement | null>;
  onToggle: () => void;
  onChapter: (index: number) => void;
  onYourTurn: () => void;
  // More Topics, beside Your Turn once the topic has played through, when the mode has another.
  onMore?: () => void;
}) {
  const box = useCanvasBox(canvasRef);
  // The player takes focus as it appears, so Space and the arrows work at once.
  const playRef = useRef<HTMLButtonElement>(null);
  useEffect(() => playRef.current?.focus({ preventScroll: true }), []);

  if (typeof document === 'undefined') return null;
  const place = playerPlace(box);
  const left = place.left;
  const last = index === chapters.length - 1;
  const toggle: keyof typeof TOGGLE_GLYPH = reduced
    ? last
      ? 'done'
      : 'next'
    : finished
      ? 'replay'
      : playing
        ? 'pause'
        : 'play';
  const toggleLabel = toggle.charAt(0).toUpperCase() + toggle.slice(1);
  const ToggleGlyph = TOGGLE_GLYPH[toggle];
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[var(--z-toast)]" data-replay-overlay="">
      {/* The player: who is showing you round and this chapter's one line, above the controls. Sits low over the
          canvas, so the toolbar and palette Example presses stay in view. */}
      <div
        role="group"
        aria-label={`Watch It Built: ${title}`}
        className="pointer-events-auto absolute flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 pb-2 pt-2.5 shadow-xl motion-safe:animate-dialog-in dark:border-slate-700 dark:bg-slate-900"
        style={
          touch && menuOpen
            ? { left, top: (box?.top ?? 56) + 64 }
            : place
        }
      >
        <p
          role="status"
          className="flex min-w-0 items-start gap-2 px-1 text-sm text-slate-800 dark:text-slate-100"
        >
          <span
            aria-hidden
            className="mt-1.5 size-2 shrink-0 rounded-full"
            style={{ background: EXAMPLE_COLOUR }}
          />
          <span className="min-w-0">
            <span className="font-semibold">Example</span>{' '}
            <span className="text-slate-600 dark:text-slate-300">{say}</span>
          </span>
        </p>
        <div className="flex items-center gap-3">
          <Tooltip label={toggleLabel}>
            <button
              ref={playRef}
              type="button"
              onClick={onToggle}
              aria-label={toggleLabel}
              className={`grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-brand-700 text-white transition-colors duration-micro hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900`}
            >
              <ToggleGlyph />
            </button>
          </Tooltip>
          <ol className="flex items-end gap-1.5">
            {chapters.map((c, i) => {
              const fill = i < index ? 1 : i > index ? 0 : Math.min(1, ms / c.ms);
              return (
                <li key={c.id}>
                  <Tooltip label={`Replay ${c.name}`}>
                    <button
                      type="button"
                      onClick={() => onChapter(i)}
                      aria-current={i === index ? 'step' : undefined}
                      className={`flex cursor-pointer flex-col gap-1 rounded-md px-1 py-0.5 text-left text-xs transition-colors duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${i === index ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'}`}
                      style={{ width: touch ? 48 : 84 }}
                    >
                      {touch ? c.shortName : c.name}
                      <span className="block h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <span
                          className="block h-full origin-left rounded-full bg-brand-600"
                          style={{ transform: `scaleX(${fill})` }}
                        />
                      </span>
                    </button>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
          {onMore && (finished || (reduced && last)) ? (
            <button
              type="button"
              onClick={onMore}
              className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors duration-micro hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              More Topics
            </button>
          ) : null}
          <button
            type="button"
            onClick={onYourTurn}
            className="shrink-0 cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-micro hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            Your Turn
          </button>
        </div>
      </div>

      {/* Example: a collaborator's cursor on a computer, a touch dot on a phone. */}
      {cursor ? (
        touch ? (
          <span
            aria-hidden
            className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{
              left: cursor.x,
              top: cursor.y,
              borderColor: EXAMPLE_COLOUR,
              background:
                cursor.pressing || cursor.holding ? `${EXAMPLE_COLOUR}66` : `${EXAMPLE_COLOUR}33`,
            }}
          />
        ) : (
          <>
            {/* A press: one ripple, never a repeating pulse (a held press read as a flicker). Holding: a steady
                soft dot under the tip. */}
            {cursor.holding ? (
              <span
                aria-hidden
                className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: cursor.x, top: cursor.y, background: `${EXAMPLE_COLOUR}40` }}
              />
            ) : cursor.pressing ? (
              <span
                aria-hidden
                data-replay-press=""
                className="absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                style={{ left: cursor.x, top: cursor.y, borderColor: EXAMPLE_COLOUR }}
              />
            ) : null}
            <RemoteCursor
              cursor={{
                id: 'example',
                name: 'Example',
                color: EXAMPLE_COLOUR,
                x: cursor.x,
                y: cursor.y,
              }}
              zoom={1}
              paint={identityVars}
            />
          </>
        )
      ) : null}
    </div>,
    document.body,
  );
}
