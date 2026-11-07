'use client';

import { memo } from 'react';
import { stageParts, type ShapeElement } from '@livehuddle/document';
import { standersLabel, type StageStander } from '@/lib/calls/stage-presence';
import { lucideMegaphone } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livehuddle/ui';
import { SizedPieceView } from './RoomView';
import { useSpeakingStage } from './speaking-stage';
import { useMicOn } from '@/lib/calls/calls-store';

const MegaphoneIcon = lucideGlyph(lucideMegaphone, 12);

const NOBODY: StageStander[] = [];

// A stage (docs/specs/009-elements/office.md "Stage"): a raised platform, its top in the element's fill laid in boards,
// a nosing along its lip, the front edge's stained skirt with footlights (docs/specs/009-elements/venue-pieces.md "The
// stronger Stage"), and a plate on it where the element's own label (its name) sits. Drawn
// at its own size like a room, so the edge keeps its height however wide the stage. Whoever stands on it is heard by
// the whole tab (docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage"; lib/calls/stage.ts), and the
// stage shows who that is, to everyone ("The stage shows who is on it"): a spotlight on its top and an On Stage badge.
export const StageView = memo(function StageView({
  element,
  stroke,
  floor,
  animClass,
  standers = NOBODY,
}: {
  element: ShapeElement;
  stroke: string;
  floor: string;
  animClass?: string;
  // Who stands on it, from presence (lib/calls/stage-presence.ts); "You" for yourself.
  standers?: readonly StageStander[];
}) {
  const { width, height } = element;
  const live = standers.length > 0;
  // You speak from this stage, unmuted: on your screen alone, the badge says everyone hears you
  // (meeting-rooms-and-stage.md "You are told you are on it").
  const micOn = useMicOn();
  const heardByAll = useSpeakingStage() === element.id && micOn;
  return (
    <>
      <SizedPieceView
        parts={stageParts(width, height)}
        width={width}
        height={height}
        stroke={stroke}
        floor={floor}
        animClass={animClass}
        label={`Stage${element.label ? `, ${element.label}` : ''}`}
      />
      {/* The spotlight: always mounted so it fades both ways. */}
      <div
        aria-hidden
        data-stage-spotlight={live ? '' : undefined}
        className={`lh-stage-spot pointer-events-none absolute inset-0 rounded-sm motion-reduce:transition-none ${
          live ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(ellipse 60% 70% at 50% 35%, rgb(255 236 179 / 0.45), rgb(255 236 179 / 0.12) 55%, transparent 75%)',
          mixBlendMode: 'screen',
        }}
      />
      {live ? (
        // The pill shrinks (its names truncate) before the badge beside it does; the pair may run past a narrow stage.
        <div
          className={`pointer-events-none absolute top-full left-1/2 mt-1.5 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap ${
            heardByAll ? 'max-w-[max(100%,26rem)]' : 'max-w-[max(100%,14rem)]'
          }`}
        >
          <div
            data-stage-live=""
            role="status"
            aria-label={`On stage: ${standersLabel(standers)}`}
            className="flex min-w-0 items-center gap-1.5 rounded-full bg-slate-900/90 py-0.5 pr-2.5 pl-2 text-[11px] font-semibold whitespace-nowrap text-white shadow-md motion-safe:animate-fade-in dark:bg-slate-100/95 dark:text-slate-900"
          >
            <span className="relative flex size-2">
              <span className="absolute inset-0 rounded-full bg-rose-500 opacity-60 motion-safe:animate-ping" />
              <span className="relative size-2 rounded-full bg-rose-500" />
            </span>
            <span className="tracking-wide uppercase">On Stage</span>
            <span className="flex -space-x-1">
              {standers.slice(0, 4).map((s, i) => (
                <span
                  key={i}
                  className="size-2.5 rounded-full ring-1 ring-slate-900/90 dark:ring-slate-100/95"
                  style={{ background: s.color }}
                />
              ))}
            </span>
            <span className="truncate font-medium">{standersLabel(standers)}</span>
          </div>
          {heardByAll ? (
            <span
              data-stage-heard-by-all=""
              className="flex shrink-0 items-center gap-1 rounded-full bg-brand-700 py-0.5 pr-2.5 pl-2 text-[11px] font-semibold text-white dark:bg-brand-600 shadow-md motion-safe:animate-fade-in"
            >
              <MegaphoneIcon />
              Everyone Can Hear You
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
});
