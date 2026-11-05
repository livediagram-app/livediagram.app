'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { HoverCard } from '@livehuddle/ui';
import { WAYFINDING_TONES } from '@livehuddle/document';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { elevatorName, spaceFloors, type WayPoint } from '@/lib/wayfinding';
import { createWayfindingStore, useWayfindingSelect, type Wayfinding } from './wayfinding-store';
import { RowAction, WayfindingHeader, WayfindingPopover } from './WayfindingPopover';

// The Elevator's face (docs/specs/009-elements/elevator.md): a button over the drawing (FurnitureView paints the
// lift) that opens the floor panel, which a walk-in opens too (through the store), and the doors that open as a
// ride arrives here. A click presses, a drag moves it (usePressWithoutDrag).

// The doors on the drawing's 112x140 grid (office-wayfinding.ts ELEVATOR_VIEW), as shares of the box.
const DOORS = { left: 17 / 112, top: 25 / 140, width: 66 / 112, height: 109 / 140 };
const DOORS_MS = 1300;

export function ElevatorFace({
  elementId,
  label = '',
  textColor,
  wayfinding,
}: {
  elementId: string;
  // The typed name (the label); unnamed reads "Elevator n" by position on its floor (elevator.md "Names").
  label?: string;
  textColor?: string;
  wayfinding?: Wayfinding;
}) {
  const [pressed, setPressed] = useState(false);
  const press = usePressWithoutDrag(wayfinding ? () => setPressed((v) => !v) : undefined);
  const positional = useWayfindingSelect(wayfinding?.store ?? NO_STORE, (s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab ? elevatorName(tab.elements, elementId) : null;
  });
  const name = label.trim() || positional || 'Elevator';
  return (
    <>
      <HoverCard
        block
        className="h-full w-full"
        title={name}
        description="Click it, or walk your character in, and pick an Elevator: on this floor or another (each tab is a floor)."
      >
        <button
          type="button"
          aria-label={name}
          aria-expanded={pressed}
          aria-haspopup="dialog"
          {...press}
          data-piece-main=""
          className="pointer-events-auto relative h-full w-full cursor-pointer rounded-md transition duration-100 active:scale-[0.98] sm:hover:brightness-[1.06]"
        >
          {wayfinding ? <ElevatorDoors elementId={elementId} wayfinding={wayfinding} /> : null}
        </button>
      </HoverCard>
      {/* Its name, under the lift like a piece of furniture's label. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-full mt-0.5 max-w-[160%] -translate-x-1/2 truncate whitespace-nowrap text-[11px] font-semibold leading-tight"
        style={{ color: textColor }}
      >
        {name}
      </span>
      {wayfinding ? (
        <ElevatorPanelHost
          elementId={elementId}
          name={name}
          wayfinding={wayfinding}
          pressed={pressed}
          onClosePressed={() => setPressed(false)}
        />
      ) : null}
    </>
  );
}

const NO_STORE = createWayfindingStore();

function ElevatorPanelHost({
  elementId,
  name,
  wayfinding,
  pressed,
  onClosePressed,
}: {
  elementId: string;
  name: string;
  wayfinding: Wayfinding;
  pressed: boolean;
  onClosePressed: () => void;
}) {
  const walkedIn = useWayfindingSelect(wayfinding.store, (s) => s.openElevatorId === elementId);
  if (!pressed && !walkedIn) return null;
  const close = () => {
    onClosePressed();
    if (walkedIn) wayfinding.actions.closeElevator();
  };
  return (
    <WayfindingPopover elementId={elementId} label={name} width={288} onClose={close}>
      <ElevatorPanel elementId={elementId} name={name} wayfinding={wayfinding} onDone={close} />
    </WayfindingPopover>
  );
}

// How long the panel shows a floor as loading before giving up on it (a failed fetch): its arrival row then.
export const FLOOR_WAIT_MS = 8000;

/**
 * Every Elevator in the space (elevator.md "The panel"): the others on this floor first (travel without changing
 * tab), then each other floor in tab order with its Elevators, a floor without one offering its arrival.
 */
export function ElevatorPanel({
  elementId,
  name,
  wayfinding,
  onDone,
}: {
  elementId: string;
  name: string;
  wayfinding: Wayfinding;
  onDone: () => void;
}) {
  const tabs = useWayfindingSelect(wayfinding.store, (s) => s.tabs);
  const activeTabId = useWayfindingSelect(wayfinding.store, (s) => s.activeTabId);
  const floors = useMemo(() => spaceFloors(tabs), [tabs]);
  // Floors nobody has opened yet are fetched on opening the panel, once (elevator.md "Floors not opened yet"); a
  // floor still not here after FLOOR_WAIT_MS (a failed fetch) shows its arrival row instead of loading forever.
  // Read once, at opening: the fetch skips loaded tabs and dedupes one in flight, so one ask per opening is enough.
  const loadingAtOpen = useRef(floors.some((f) => f.loading));
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!loadingAtOpen.current) return;
    wayfinding.actions.loadFloors();
    const t = setTimeout(() => setWaited(true), FLOOR_WAIT_MS);
    return () => clearTimeout(t);
  }, [wayfinding]);
  const ride = (tabId: string, point: WayPoint, ignoreId?: string) => {
    onDone();
    wayfinding.actions.go({ tabId, point, ignoreId });
  };
  const index = floors.findIndex((f) => f.tabId === activeTabId);
  const here = floors[index];
  const others = floors.filter((f) => f.tabId !== activeTabId);
  const sameFloor = here?.elevators.filter((e) => e.id !== elementId) ?? [];
  return (
    <div>
      <WayfindingHeader title={name} line="Choose an Elevator, on this floor or another." />
      {here ? (
        <section aria-label={`This Floor, ${here.name}`} className="px-2 pt-2">
          <FloorHeading number={index + 1} name={here.name} current />
          {sameFloor.length === 0 ? (
            <p className="px-1.5 pb-1 pl-10 text-[11px] text-slate-500 dark:text-slate-400">
              No other Elevator on this floor
            </p>
          ) : null}
          <ul>
            {sameFloor.map((lift) => (
              <LiftRow
                key={lift.id}
                name={lift.name}
                onGo={() => ride(here.tabId, lift.exit, lift.id)}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {others.map((floor) => (
        <section key={floor.tabId} aria-label={floor.name} className="px-2 pt-2">
          <FloorHeading number={floors.indexOf(floor) + 1} name={floor.name} />
          {floor.loading && !waited ? (
            <p
              role="status"
              className="px-1.5 pb-1 pl-10 text-[11px] text-slate-500 dark:text-slate-400"
            >
              Loading this floor
            </p>
          ) : (
            <ul>
              {floor.elevators.map((lift) => (
                <LiftRow
                  key={lift.id}
                  name={lift.name}
                  floor={floor.name}
                  onGo={() => ride(floor.tabId, lift.exit, lift.id)}
                />
              ))}
              {floor.elevators.length === 0 ? (
                <LiftRow
                  name={floor.arrivesAt === 'pad' ? 'Its Avatar Pad' : 'The Middle'}
                  floor={floor.name}
                  note="No Elevator on this floor"
                  onGo={() => ride(floor.tabId, floor.arrival)}
                />
              ) : null}
            </ul>
          )}
        </section>
      ))}
      <div className="h-2" />
      {floors.length <= 1 ? (
        <p className="border-t border-slate-100 px-3.5 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          This space has one floor. Add a tab with an Elevator on it to make another.
        </p>
      ) : null}
    </div>
  );
}

function FloorHeading({
  number,
  name,
  current = false,
}: {
  number: number;
  name: string;
  current?: boolean;
}) {
  return (
    <h3 className="flex items-center gap-2.5 px-1.5 pb-1">
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold tabular-nums ${
          current
            ? 'bg-amber-400 text-slate-900 shadow-[0_0_0_3px_rgba(251,191,36,0.3)]'
            : 'border border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        <span className="text-optical-centre">{number}</span>
      </span>
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {name}
      </span>
      {current ? (
        <span className="rounded-full bg-sky-100 px-1.5 py-[1px] text-[9.5px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          You Are Here
        </span>
      ) : null}
    </h3>
  );
}

function LiftRow({
  name,
  floor,
  note,
  onGo,
}: {
  name: string;
  floor?: string;
  note?: string;
  onGo: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg py-1 pl-10 pr-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium leading-tight">{name}</span>
        {note ? (
          <span className="block text-[10.5px] text-slate-500 dark:text-slate-400">{note}</span>
        ) : null}
      </span>
      <RowAction
        primary
        label={floor ? `Go to ${name} on ${floor}` : `Go to ${name}`}
        onClick={onGo}
      >
        Go
      </RowAction>
    </li>
  );
}

// The doors opening as a ride arrives here (elevator.md "Arriving"): the shaft's dark behind two steel panels that
// slide apart and close again. Drawn only for an arrival, and not at all under reduced motion.
function ElevatorDoors({ elementId, wayfinding }: { elementId: string; wayfinding: Wayfinding }) {
  const seq = useWayfindingSelect(wayfinding.store, (s) =>
    s.arrivalElevatorId === elementId ? s.arrivalSeq : 0,
  );
  const leftRef = useRef<HTMLSpanElement>(null);
  const rightRef = useRef<HTMLSpanElement>(null);
  const [finished, setFinished] = useState(0);
  const playing = seq > 0 && seq !== finished && !prefersReducedMotion();
  useEffect(() => {
    if (!playing) return;
    const timing = { duration: DOORS_MS, easing: 'ease-in-out' };
    const frames = (dir: 1 | -1) => [
      { transform: 'translateX(0)' },
      { transform: `translateX(${dir * 92}%)`, offset: 0.3 },
      { transform: `translateX(${dir * 92}%)`, offset: 0.7 },
      { transform: 'translateX(0)' },
    ];
    const a = leftRef.current?.animate(frames(-1), timing);
    const b = rightRef.current?.animate(frames(1), timing);
    const done = window.setTimeout(() => setFinished(seq), DOORS_MS);
    return () => {
      a?.cancel();
      b?.cancel();
      window.clearTimeout(done);
    };
  }, [playing, seq]);
  if (!playing) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute overflow-hidden"
      style={{
        left: `${DOORS.left * 100}%`,
        top: `${DOORS.top * 100}%`,
        width: `${DOORS.width * 100}%`,
        height: `${DOORS.height * 100}%`,
        background: `linear-gradient(${WAYFINDING_TONES.display}, #0f172a)`,
      }}
    >
      <span
        ref={leftRef}
        className="absolute inset-y-0 left-0 w-1/2 border-r border-slate-400"
        style={{ background: WAYFINDING_TONES.steel }}
      />
      <span
        ref={rightRef}
        className="absolute inset-y-0 right-0 w-1/2 border-l border-slate-400"
        style={{ background: WAYFINDING_TONES.steel }}
      />
    </span>
  );
}
