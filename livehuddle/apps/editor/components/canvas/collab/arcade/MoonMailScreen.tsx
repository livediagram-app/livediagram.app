'use client';

// Moon Mail's screen and strip (docs/specs/009-elements/social-pieces.md "The panel", "Controls"): the square canvas
// the game's loop paints (useMoonMail), the card over it before a run, while paused and at Game Over, and the strip
// under it: the score, the streak, the shields left and the Pause button.

import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { lucidePause, lucideShieldCheck } from '@liveworkspace/icons/lucide';
import { Button, lucideGlyph, Tooltip } from '@livehuddle/ui';
import { arcadePlaceLine } from '@/lib/arcade/arcade-post';
import type { MoonMailGame } from './useMoonMail';

const PauseIcon = lucideGlyph(lucidePause, 16);
const ShieldIcon = lucideGlyph(lucideShieldCheck, 16);

const SCORE = new Intl.NumberFormat('en-GB');

/** How the last run ended: its score and, when it made the table, its place. */
export type RunResult = { score: number; place: number | null };

// A press on a card's button is the button's, never a tap on the screen behind it.
const keepPress = (e: ReactPointerEvent) => e.stopPropagation();

export function MoonMailScreen({ game, result }: { game: MoonMailGame; result: RunResult | null }) {
  const { phase, strip, screenRef, canvasRef } = game;
  return (
    <div className="px-3 pt-3">
      <div
        ref={screenRef}
        tabIndex={0}
        role="application"
        aria-roledescription="game"
        aria-label="Moon Mail. Arrow Up or W hops out, Arrow Down or S hops in, P pauses."
        data-moon-mail-screen=""
        onPointerDown={game.onScreenPointerDown}
        className="relative aspect-square w-full cursor-pointer touch-none select-none overflow-hidden rounded-lg bg-[#060a1c] shadow-inner outline-none ring-1 ring-slate-900/20 focus-visible:ring-2 focus-visible:ring-sky-400 dark:ring-white/10"
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        {phase === 'ready' ? (
          <ScreenCard>
            <p className="text-[15px] font-semibold text-white">Deliver the Moon&apos;s Mail</p>
            <p className="max-w-[16rem] text-[12px] leading-snug text-slate-200">
              Hop between orbits to collect letters and dodge the rocks.
            </p>
            <Button size="sm" onPointerDown={keepPress} onClick={game.start}>
              Start
            </Button>
            <p className="text-[12px] text-slate-200">Press Space or Tap to Start</p>
          </ScreenCard>
        ) : phase === 'paused' ? (
          <ScreenCard>
            <p className="text-[18px] font-semibold text-white">Paused</p>
            <Button size="sm" onPointerDown={keepPress} onClick={game.resume}>
              Resume
            </Button>
          </ScreenCard>
        ) : phase === 'over' ? (
          <ScreenCard>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-200">
              Game Over
            </p>
            <p className="text-[40px] font-bold leading-none text-white tabular-nums">
              {SCORE.format(result?.score ?? strip.score)}
            </p>
            {result?.place ? (
              <p className="text-[13px] font-semibold text-amber-300" role="status">
                {arcadePlaceLine(result.place)}
              </p>
            ) : null}
            <Button size="sm" onPointerDown={keepPress} onClick={game.start}>
              Play Again
            </Button>
          </ScreenCard>
        ) : null}
      </div>
      <Strip game={game} />
    </div>
  );
}

function ScreenCard({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#060a1c]/60 px-6 text-center motion-safe:animate-fade-in">
      {children}
    </div>
  );
}

function Strip({ game }: { game: MoonMailGame }) {
  const { phase, strip, shieldsMax } = game;
  const playing = phase === 'playing';
  return (
    <div className="flex h-11 items-center gap-3 px-0.5 text-slate-700 dark:text-slate-200">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Score
        </span>
        <span
          className="min-w-[3ch] text-[15px] font-semibold tabular-nums"
          data-moon-mail-score=""
        >
          {SCORE.format(strip.score)}
        </span>
      </div>
      <span
        className={`rounded-full px-1.5 py-px text-[12px] font-semibold tabular-nums ${
          strip.streak > 1
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
        }`}
      >
        <span aria-hidden>×{strip.streak}</span>
        <span className="sr-only">Streak times {strip.streak}</span>
      </span>
      <span
        className="ml-auto flex items-center gap-0.5"
        role="img"
        aria-label={`${strip.shields} of ${shieldsMax} shields left`}
      >
        {Array.from({ length: shieldsMax }, (_, i) => (
          <ShieldMark key={i} on={i < strip.shields} />
        ))}
      </span>
      {playing ? (
        <Tooltip label="Pause (P)">
          <button
            type="button"
            aria-label="Pause"
            onClick={game.pause}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-sky-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <PauseIcon />
          </button>
        </Tooltip>
      ) : (
        // Holds the strip's height and the shields' place while no run plays.
        <span aria-hidden className="h-8 w-8" />
      )}
    </div>
  );
}

// One shield: in colour while you have it, faint once it is gone.
function ShieldMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={on ? 'text-sky-600 dark:text-sky-300' : 'text-slate-300 dark:text-slate-600'}
    >
      <ShieldIcon />
    </span>
  );
}
