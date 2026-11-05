'use client';

import { useMemo, useState } from 'react';
import { HoverCard } from '@livehuddle/ui';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { spacePlaces, type PlaceKind, type WayPerson } from '@/lib/wayfinding';
import { useWayfindingSelect, type Wayfinding } from './wayfinding-store';
import { PeopleChips, RowAction, WayfindingHeader, WayfindingPopover } from './WayfindingPopover';

// The Directory's face (docs/specs/009-elements/directory.md): a button over the drawing (FurnitureView paints the
// stand) that opens the list of the space's places and who is in each. A click presses, a drag moves it
// (usePressWithoutDrag). The list reads the canvas's wayfinding store, and only while it is open.

const KIND_DOT: Record<PlaceKind, string> = {
  room: 'bg-amber-400',
  pod: 'bg-violet-400',
  stage: 'bg-rose-400',
};
const KIND_WORD: Record<PlaceKind, string> = { room: 'Room', pod: 'Office Pod', stage: 'Stage' };

export function DirectoryFace({
  elementId,
  wayfinding,
}: {
  elementId: string;
  wayfinding?: Wayfinding;
}) {
  const [open, setOpen] = useState(false);
  const press = usePressWithoutDrag(wayfinding ? () => setOpen((v) => !v) : undefined);
  return (
    <>
      <HoverCard
        block
        className="h-full w-full"
        title="Directory"
        description="Click to see every room in this space and who is in it, then Walk There or Go."
      >
        <button
          type="button"
          aria-label="Directory"
          aria-expanded={open}
          aria-haspopup="dialog"
          {...press}
          className="pointer-events-auto relative h-full w-full cursor-pointer rounded-md transition duration-100 active:scale-[0.98] sm:hover:brightness-[1.06]"
        />
      </HoverCard>
      {open && wayfinding ? (
        <WayfindingPopover
          elementId={elementId}
          label="Directory"
          width={320}
          onClose={() => setOpen(false)}
        >
          <DirectoryList wayfinding={wayfinding} onDone={() => setOpen(false)} />
        </WayfindingPopover>
      ) : null}
    </>
  );
}

export function DirectoryList({
  wayfinding,
  onDone,
}: {
  wayfinding: Wayfinding;
  onDone: () => void;
}) {
  const { store, actions } = wayfinding;
  const tabs = useWayfindingSelect(store, (s) => s.tabs);
  const activeTabId = useWayfindingSelect(store, (s) => s.activeTabId);
  const people = useWayfindingSelect(store, (s) => s.people);
  // The current floor first, then the rest in tab order.
  const groups = useMemo(() => {
    const all = spacePlaces(tabs);
    const here = all.filter((g) => g.tab.id === activeTabId);
    return [...here, ...all.filter((g) => g.tab.id !== activeTabId)];
  }, [tabs, activeTabId]);
  const byPlace = useMemo(() => {
    const map = new Map<string, WayPerson[]>();
    for (const p of people) {
      const k = p.placeId ?? `around:${p.tabId}`;
      const list = map.get(k);
      if (list) list.push(p);
      else map.set(k, [p]);
    }
    return map;
  }, [people]);
  const anyPlace = groups.some((g) => g.places.length > 0);
  return (
    <div>
      <WayfindingHeader title="Directory" line="Every room in this space, and who is in it now." />
      {!anyPlace ? (
        <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path d="M10 21H3V3h18v18h-7" />
              <path d="M10 21v-4" />
            </svg>
          </span>
          <p className="text-[12.5px] font-semibold">No Rooms Yet</p>
          <p className="max-w-[16rem] text-[11px] text-slate-500 dark:text-slate-400">
            Rooms, Office Pods and Stages you add to this space appear here, with who is in each.
          </p>
        </div>
      ) : null}
      {anyPlace
        ? groups.map(({ tab, places }) => {
            const here = tab.id === activeTabId;
            const around = byPlace.get(`around:${tab.id}`) ?? [];
            return (
              <section key={tab.id} aria-label={tab.name} className="px-2 pb-2 pt-2.5">
                <h3 className="flex items-center gap-2 px-1.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <span className="truncate">{tab.name}</span>
                  {here ? (
                    <span className="rounded-full bg-sky-100 px-1.5 py-[1px] text-[9.5px] normal-case tracking-normal text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      This Floor
                    </span>
                  ) : null}
                </h3>
                {places.length === 0 ? (
                  <p className="px-1.5 py-1 text-[11px] text-slate-500 dark:text-slate-400">
                    No rooms on this floor
                  </p>
                ) : null}
                <ul className="flex flex-col">
                  {places.map((place) => {
                    const inside = here ? (byPlace.get(place.id) ?? []) : [];
                    return (
                      <li
                        key={place.id}
                        className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <span
                          aria-hidden
                          className={`h-2 w-2 shrink-0 rounded-full ${KIND_DOT[place.kind]}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium leading-tight">
                            {place.name}
                          </span>
                          <span className="block text-[10.5px] text-slate-500 dark:text-slate-400">
                            {KIND_WORD[place.kind]}
                            {here
                              ? ` · ${inside.length === 0 ? 'Empty' : `${inside.length} here`}`
                              : ''}
                          </span>
                        </span>
                        <PeopleChips people={inside} />
                        {here ? (
                          <RowAction
                            label={`Walk to ${place.name}`}
                            onClick={() => {
                              onDone();
                              actions.walkThere(place);
                            }}
                          >
                            Walk There
                          </RowAction>
                        ) : null}
                        <RowAction
                          primary
                          label={`Go to ${place.name}`}
                          onClick={() => {
                            onDone();
                            actions.go({ tabId: place.tabId, point: place.arrival });
                          }}
                        >
                          Go
                        </RowAction>
                      </li>
                    );
                  })}
                  {around.length > 0 ? (
                    <li className="flex items-center gap-2 px-1.5 py-1.5">
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full border border-slate-300 dark:border-slate-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-medium leading-tight text-slate-600 dark:text-slate-300">
                          {here ? 'Around' : 'On This Floor'}
                        </span>
                        <span className="block text-[10.5px] text-slate-500 dark:text-slate-400">
                          {here ? 'In no room' : 'Which room is shown when you are there'}
                        </span>
                      </span>
                      <PeopleChips people={around} />
                    </li>
                  ) : null}
                </ul>
              </section>
            );
          })
        : null}
    </div>
  );
}
