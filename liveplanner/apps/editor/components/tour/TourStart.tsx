'use client';

// The hands-on tours' start panel (docs/specs/026-plan/plan-tour.md "Starting a tour"): what a press on Get Started
// opens, as the Get Started popover every app draws (GetStartedPopover); with no button on show (from Settings), in the
// mission strip's place. Nothing is dealt, opened or drawn until the person picks a track here. With one
// track it says what will happen and offers Start; with several (Boards) it lists them, each with a line on what it
// teaches and a tick once taken. Not Now closes it and leaves the tour on offer.

import { Button } from '@liveplanner/ui';
import { useState } from 'react';
import { TRACK_ICONS } from './track-icons';
import { TourTopics } from '@liveworkspace/workbench/components/tour/TourTopics';
import {
  GetStartedPopover,
  getStartedAnchor,
} from '@liveworkspace/workbench/components/tour/GetStartedPopover';
import { StripFrame } from './MissionStrip';

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
  // From the footer's Get Started button: the Get Started popover every app opens, its tracks as lessons.
  const [anchor] = useState(getStartedAnchor);
  if (anchor) {
    return (
      <GetStartedPopover
        anchor={anchor}
        topics={tracks.map((t) => ({
          id: t.id,
          title: t.title,
          line: t.line || line,
          ...(t.missions
            ? { meta: `${t.missions} ${t.missions === 1 ? 'mission' : 'missions'}` }
            : {}),
          ...(TRACK_ICONS[t.id] ? { icon: TRACK_ICONS[t.id] } : {}),
          taken: t.taken,
        }))}
        onPick={onPick}
        onClose={onClose}
        idAttribute="data-tour-track"
      />
    );
  }
  const only = tracks.length === 1 ? tracks[0] : undefined;
  return (
    <StripFrame name={name} onEnd={onClose} endLabel="Not Now">
      <div data-tour-start="" className="flex animate-view-forward flex-col gap-3">
        {only ? (
          <>
            <div>
              <h3 className="text-[15px] font-semibold leading-tight text-slate-900 dark:text-white">
                {heading}
              </h3>
              <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
                {line}
              </p>
            </div>
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
          </>
        ) : (
          // The rows are the workbench's, shared with livediagram's Watch It Built start panel.
          <TourTopics
            heading={heading}
            line={line}
            topics={tracks}
            onPick={onPick}
            idAttribute="data-tour-track"
          />
        )}
      </div>
    </StripFrame>
  );
}
