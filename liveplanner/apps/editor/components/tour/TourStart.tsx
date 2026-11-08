'use client';

// The hands-on tours' start panel (docs/specs/026-plan/plan-tour.md "Starting a tour"): what a press on Start Tour
// opens, in the mission strip's place. Nothing is dealt, opened or drawn until the person picks a track here. With one
// track it says what will happen and offers Start; with several (Boards) it lists them, each with a line on what it
// teaches and a tick once taken. Not Now closes it and leaves the tour on offer.

import { Button, lucideGlyph } from '@liveplanner/ui';
import { lucideCheck, lucideChevronRight } from '@liveworkspace/icons/lucide';
import { StripFrame } from './MissionStrip';

const TickIcon = lucideGlyph(lucideCheck, 12);
const OpenIcon = lucideGlyph(lucideChevronRight, 16);

export type StartTrack<Id extends string> = {
  id: Id;
  title: string;
  // What it teaches, in one line.
  line: string;
  // How many quick missions it holds, when known before it starts: said as "5 quick missions".
  missions?: number;
  taken: boolean;
};

export function TourStart<Id extends string>({
  name,
  heading,
  line,
  tracks,
  startLabel = 'Start',
  onPick,
  onClose,
}: {
  // The tour's name over the panel: "Boards Tour".
  name: string;
  heading: string;
  line: string;
  tracks: readonly StartTrack<Id>[];
  // A single track's button: "Deal the Cards".
  startLabel?: string;
  onPick: (id: Id) => void;
  onClose: () => void;
}) {
  const only = tracks.length === 1 ? tracks[0] : undefined;
  return (
    <StripFrame name={name} onEnd={onClose} endLabel="Not Now">
      <div data-tour-start="" className="flex animate-view-forward flex-col gap-3">
        <div>
          <h3 className="text-[15px] font-semibold leading-tight text-slate-900 dark:text-white">
            {heading}
          </h3>
          <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">{line}</p>
        </div>
        {only ? (
          <div className="flex items-center gap-3">
            {only.missions ? (
              <span className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400">
                {only.missions} quick {only.missions === 1 ? 'mission' : 'missions'}
              </span>
            ) : null}
            <span className="flex-1" />
            <Button size="sm" onClick={() => onPick(only.id)}>
              {startLabel}
            </Button>
          </div>
        ) : (
          <ul className="-mx-1.5 flex flex-col">
            {tracks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  data-tour-track={t.id}
                  onClick={() => onPick(t.id)}
                  className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-1.5 py-2 text-left outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold leading-tight text-slate-900 dark:text-white">
                        {t.title}
                      </span>
                      {t.taken ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-px text-[11px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                          <TickIcon />
                          Done
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
                      {t.line}
                    </span>
                  </span>
                  <span className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 dark:text-slate-400">
                    <OpenIcon />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </StripFrame>
  );
}
