'use client';

import { useMemo, useState } from 'react';
import { HoverCard, lucideGlyph } from '@livehuddle/ui';
import { lucideArrowDown, lucideArrowUp } from '@liveworkspace/icons/lucide';
import type { ShapeElement } from '@livehuddle/document';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { stairsFlights, type StairsFlight, type StairsLanding } from '@/lib/wayfinding';
import { useFloorsOnOpen } from './useFloorsOnOpen';
import { useWayfindingSelect, type Wayfinding } from './wayfinding-store';
import {
  LazyWayfindingPopover,
  WayfindingHeader,
  wayfindingPrefetchProps,
} from './wayfinding-panel-parts';

// The Stairs' face (docs/specs/009-elements/stairs.md): a button over the drawing (FurnitureView paints the flight)
// that opens the Up / Down panel, which a walk-on opens too (through the store). Choosing a floor climbs the flight
// (useWayfinding's `climb`). A click presses, a drag moves it (usePressWithoutDrag).

const NAME = 'Stairs';
const UpIcon = lucideGlyph(lucideArrowUp, 16);
const DownIcon = lucideGlyph(lucideArrowDown, 16);

export function StairsFace({
  element,
  wayfinding,
}: {
  element: ShapeElement;
  wayfinding?: Wayfinding;
}) {
  const [pressed, setPressed] = useState(false);
  const press = usePressWithoutDrag(wayfinding ? () => setPressed((v) => !v) : undefined);
  return (
    <>
      <HoverCard
        block
        className="h-full w-full"
        title={NAME}
        description="Click it, or walk your character on, and climb to the floor above or below (each tab is a floor)."
      >
        <button
          type="button"
          aria-label={NAME}
          aria-expanded={pressed}
          aria-haspopup="dialog"
          {...wayfindingPrefetchProps}
          {...press}
          data-piece-main=""
          className="pointer-events-auto relative h-full w-full cursor-pointer rounded-md transition duration-100 active:scale-[0.98] sm:hover:brightness-[1.06]"
        />
      </HoverCard>
      {wayfinding ? (
        <StairsPanelHost
          element={element}
          wayfinding={wayfinding}
          pressed={pressed}
          onClosePressed={() => setPressed(false)}
        />
      ) : null}
    </>
  );
}

function StairsPanelHost({
  element,
  wayfinding,
  pressed,
  onClosePressed,
}: {
  element: ShapeElement;
  wayfinding: Wayfinding;
  pressed: boolean;
  onClosePressed: () => void;
}) {
  const walkedIn = useWayfindingSelect(wayfinding.store, (s) => s.openPanelId === element.id);
  if (!pressed && !walkedIn) return null;
  const close = () => {
    onClosePressed();
    if (walkedIn) wayfinding.actions.closePanel();
  };
  return (
    <LazyWayfindingPopover elementId={element.id} label={NAME} width={264} onClose={close}>
      <StairsPanel element={element} wayfinding={wayfinding} onDone={close} />
    </LazyWayfindingPopover>
  );
}

/**
 * The floor above and the floor below (stairs.md "The panel"), each one press: a floor not fetched yet reads as
 * loading until it lands (or FLOOR_WAIT_MS passes), the top and ground floors say there is nothing past them.
 */
export function StairsPanel({
  element,
  wayfinding,
  onDone,
}: {
  element: ShapeElement;
  wayfinding: Wayfinding;
  onDone: () => void;
}) {
  const tabs = useWayfindingSelect(wayfinding.store, (s) => s.tabs);
  const activeTabId = useWayfindingSelect(wayfinding.store, (s) => s.activeTabId);
  const { id, x, y, width, height } = element;
  const floors = useMemo(
    () => stairsFlights(tabs, activeTabId, { x, y, width, height }),
    [tabs, activeTabId, x, y, width, height],
  );
  const waited = useFloorsOnOpen(Boolean(floors.up?.loading || floors.down?.loading), wayfinding);
  const take = (flight: StairsFlight) => {
    onDone();
    wayfinding.actions.climb({
      from: { id, x, y, width, height, chairFacing: element.chairFacing },
      flight,
    });
  };
  const { here } = floors;
  return (
    <div>
      <WayfindingHeader
        title={NAME}
        line={
          here ? `Floor ${here.number} of ${floors.count}, ${here.name}` : 'Up or down a floor.'
        }
      />
      <ul className="flex flex-col gap-1 p-2">
        <FlightRow dir="up" flight={floors.up} waited={waited} onTake={take} />
        <FlightRow dir="down" flight={floors.down} waited={waited} onTake={take} />
      </ul>
      {floors.count <= 1 ? (
        <p className="border-t border-slate-100 px-3.5 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          This space has one floor. Add a tab with Stairs on it to make another.
        </p>
      ) : null}
    </div>
  );
}

const LANDS: Record<Exclude<StairsLanding['at'], 'stairs'>, string> = {
  elevator: 'Lands at its Elevator',
  pad: 'Lands at its Avatar Pad',
  middle: 'Lands in its middle',
};

const WORD = { up: 'Up', down: 'Down' } as const;
const NONE = { up: 'No floor above', down: 'No floor below' } as const;

// One way off this floor: the whole row is the button, an arrow, the way and the floor's name, its number at the end.
function FlightRow({
  dir,
  flight,
  waited,
  onTake,
}: {
  dir: 'up' | 'down';
  flight: StairsFlight | null;
  waited: boolean;
  onTake: (flight: StairsFlight) => void;
}) {
  const Arrow = dir === 'up' ? UpIcon : DownIcon;
  const loading = flight !== null && flight.loading && !waited;
  const landing =
    flight && !loading && flight.landing.at !== 'stairs' ? LANDS[flight.landing.at] : null;
  const arrow = (on: boolean) => (
    <span
      aria-hidden
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        on
          ? 'bg-sky-600 text-white group-hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:group-hover:bg-sky-400'
          : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      <Arrow />
    </span>
  );
  if (!flight) {
    return (
      <li className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
        {arrow(false)}
        <span className="text-[12px] text-slate-500 dark:text-slate-400">{NONE[dir]}</span>
      </li>
    );
  }
  const text = (
    <span className="min-w-0 flex-1">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {WORD[dir]}
      </span>
      <span className="block truncate text-[12.5px] font-medium leading-tight">{flight.name}</span>
      {loading ? (
        <span role="status" className="block text-[10.5px] text-slate-500 dark:text-slate-400">
          Loading this floor
        </span>
      ) : landing ? (
        <span className="block text-[10.5px] text-slate-500 dark:text-slate-400">{landing}</span>
      ) : null}
    </span>
  );
  const number = (
    <span
      aria-hidden
      className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white px-1 text-[10.5px] font-bold tabular-nums text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
    >
      <span className="text-optical-centre">{flight.number}</span>
    </span>
  );
  if (loading) {
    return (
      <li className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
        {arrow(false)}
        {text}
        {number}
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        aria-label={`${WORD[dir]} to ${flight.name}`}
        onClick={() => onTake(flight)}
        className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500 active:scale-[0.99] dark:hover:bg-slate-800/60"
      >
        {arrow(true)}
        {text}
        {number}
      </button>
    </li>
  );
}
