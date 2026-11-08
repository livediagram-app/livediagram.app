'use client';

// The mission strip (docs/specs/026-plan/plan-tour.md "The mission strip"): the hands-on tours' one panel. The current
// mission as a short instruction and a line on why, one segment per mission, Hint and End; once a mission is done its
// lesson in place of the instruction, and after the last, the track's finish. Never a dialog: the work under it stays
// fully usable and nothing is dimmed. A computer floats it centred above the footer; a phone docks it as a bottom
// sheet (at the top while a dialog of its own covers the bottom, as a card's panel does on a phone).

import { useEffect, useState, type ReactNode } from 'react';
import { Button, lucideGlyph, Portal } from '@liveplanner/ui';
import { lucideCheck, lucideLightbulb, lucideX } from '@liveworkspace/icons/lucide';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useOpenModalCount } from '@liveworkspace/workbench/lib/modal-guard';
import type { MissionRun } from './missions';
import { HintRing } from './HintRing';

const CheckIcon = lucideGlyph(lucideCheck, 14);
const HintIcon = lucideGlyph(lucideLightbulb, 14);
const EndIcon = lucideGlyph(lucideX, 14);

// The gap between the strip and the footer (or the window's edge on a phone).
const STRIP_GAP_PX = 12;

// How far above the window's bottom the strip floats: clear of the editor's footer (the tab bar), measured.
function useFooterClearance(): number {
  const [clear, setClear] = useState(0);
  useEffect(() => {
    const measure = () => {
      const bar = document.querySelector('[data-editor-tabbar]');
      const top = bar?.getBoundingClientRect().top;
      setClear(top !== undefined && top > 0 ? Math.max(0, window.innerHeight - top) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return clear;
}

export function MissionStrip<Ctx>({
  name,
  run,
  onEnd,
  finish,
  note,
  placement = 'page',
}: {
  // The track's name: Practice Sprint, Five Small Wins, Layout View.
  name: string;
  run: MissionRun<Ctx>;
  onEnd: () => void;
  // The track's finish: its line and its choices, shown after the last mission.
  finish: ReactNode;
  // A line in place of the mission's why, for something the track noticed (a WIP limit gone over).
  note?: string | null;
  // 'page' floats over the editor; 'dialog' sits at the bottom of the practice sheet's dialog, in its flow.
  placement?: 'page' | 'dialog';
}) {
  const phone = useIsMobileViewport();
  const clearance = useFooterClearance();
  const coveredBelow = useOpenModalCount() > 0 && placement === 'page' && phone;
  const { mission, phase, index, count } = run;
  const ring = run.hint?.ring?.() ?? null;
  const body = (
    <section
      aria-label={name}
      data-mission-strip=""
      className={`pointer-events-auto flex flex-col gap-2.5 border border-slate-200 bg-white px-4 pb-3.5 pt-3 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${
        placement === 'dialog'
          ? 'rounded-xl'
          : phone
            ? coveredBelow
              ? 'rounded-b-2xl border-t-0 shadow-[0_10px_28px_-12px_rgba(15,23,42,0.45)]'
              : 'rounded-t-2xl border-b-0 pb-[max(0.875rem,env(safe-area-inset-bottom))] shadow-[0_-10px_28px_-14px_rgba(15,23,42,0.45)]'
            : 'rounded-2xl shadow-[0_18px_40px_-18px_rgba(15,23,42,0.45),0_2px_6px_-2px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7),0_2px_6px_-2px_rgba(0,0,0,0.4)]'
      }`}
    >
      <header className="flex items-center gap-3">
        <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{name}</span>
        <Segments count={count} index={index} phase={phase} />
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="xs"
          className="-mr-2 gap-1 px-2"
          onClick={onEnd}
          aria-label={`End ${name}`}
        >
          <EndIcon />
          End
        </Button>
      </header>
      {/* The mission, its lesson or the finish, spoken as each arrives. */}
      <div aria-live="polite" className="min-h-[3.25rem]">
        {phase === 'finish' ? (
          <div key="finish" className="animate-view-forward">
            {finish}
          </div>
        ) : mission ? (
          phase === 'lesson' ? (
            <p
              key={`${mission.id}-lesson`}
              className="flex animate-view-forward items-start gap-2 text-[14px] leading-snug text-emerald-700 dark:text-emerald-300"
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950">
                <CheckIcon />
              </span>
              <span>{mission.lesson}</span>
            </p>
          ) : (
            <div key={mission.id} className="animate-view-forward">
              <h3 className="text-[15px] font-semibold leading-tight text-slate-900 dark:text-white">
                {mission.title}
              </h3>
              <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
                {note ?? mission.why}
              </p>
            </div>
          )
        ) : null}
      </div>
      {phase === 'doing' && mission && (run.hint || run.moreHints) ? (
        <footer className="flex items-start gap-2">
          {run.hint ? (
            <p
              key={run.hintLevel}
              className="flex-1 animate-view-forward rounded-lg bg-brand-50 px-2.5 py-1.5 text-[12.5px] leading-snug text-brand-900 dark:bg-brand-500/15 dark:text-brand-100"
            >
              {run.hint.text}
            </p>
          ) : (
            <span className="flex-1" />
          )}
          {run.moreHints ? (
            <Button
              variant="secondary"
              size="xs"
              className="shrink-0 gap-1.5"
              onClick={run.showHint}
            >
              <HintIcon />
              {run.hintLevel === 0 ? 'Hint' : 'More Help'}
            </Button>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
  if (placement === 'dialog') return body;
  return (
    <Portal>
      {ring ? <HintRing selector={ring} /> : null}
      <div
        data-mission-strip-layer=""
        className={`pointer-events-none fixed inset-x-0 z-[var(--z-toast)] flex justify-center ${
          phone ? '' : 'px-4'
        }`}
        style={coveredBelow ? { top: 0 } : { bottom: phone ? clearance : clearance + STRIP_GAP_PX }}
      >
        <div className={phone ? 'w-full' : 'w-[26rem] max-w-full'}>{body}</div>
      </div>
    </Portal>
  );
}

// One segment per mission: done ones filled, the current one filling (or filled once its lesson shows), the rest
// empty. Read as "Mission 2 of 4" by a screen reader.
function Segments({
  count,
  index,
  phase,
}: {
  count: number;
  index: number;
  phase: 'doing' | 'lesson' | 'finish';
}) {
  const done = phase === 'finish' ? count : phase === 'lesson' ? index + 1 : index;
  return (
    <span
      role="img"
      aria-label={phase === 'finish' ? `All ${count} done` : `Mission ${index + 1} of ${count}`}
      className="flex items-center gap-1"
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-1 w-4 rounded-full transition-colors duration-200 ${
            i < done
              ? 'bg-emerald-500 dark:bg-emerald-400'
              : i === index && phase === 'doing'
                ? 'bg-brand-500 dark:bg-brand-400'
                : 'bg-slate-200 dark:bg-slate-700'
          }`}
        />
      ))}
    </span>
  );
}
