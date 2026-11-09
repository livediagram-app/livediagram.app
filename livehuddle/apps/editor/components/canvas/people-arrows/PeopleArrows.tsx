'use client';

// People arrows (docs/specs/008-canvas/people-arrows.md): an arrow at the canvas's edge, in each person's colour,
// pointing to the people on your tab you cannot see. This renders the layer and one button per person, and only when
// WHO has an arrow changes; the frame loop (people-arrows-engine.ts) moves them.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Tooltip, identityVars } from '@livehuddle/ui';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { useViewportStore } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { glideViewport } from '@liveworkspace/workbench/lib/viewport-glide';
import type { PeerRowsSource } from '@/lib/peer-motion';
import { readPeerAvatarRows, usePeerAvatarSlice } from '@/hooks/collab/usePeerRows';
import type { RemoteAvatarRow } from '@/lib/presence-rows';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { initialsOf } from '@liveworkspace/model-core/names';
import {
  ARROW_SIZE,
  arrowPeopleOf,
  bodyOf,
  samePeople,
  type ArrowPerson,
} from './people-arrows-geometry';
import {
  createPeopleArrowsEngine,
  type ArrowNode,
  type PeopleArrowsEngine,
} from './people-arrows-engine';

/** How long a newly arrived person's arrow nudges harder. */
const FRESH_MS = 4000;

// The other humans on the tab, walking or not: the tab bar's presence says where each one is looking.
function humansOnTab(peers: PeerRowsSource): string[] {
  const ids: string[] = [];
  for (const [id, tab] of peers.tabFocus) {
    if (id !== peers.selfId && tab === peers.activeId && peers.livePresenceById.has(id))
      ids.push(id);
  }
  return ids;
}

/** The people who get an arrow, from the characters on the tab and the room's presence. */
export function arrowPeopleFor(
  peers: PeerRowsSource,
  rows: readonly RemoteAvatarRow[],
): ArrowPerson[] {
  return arrowPeopleOf(
    rows,
    humansOnTab(peers),
    (id) => peers.livePresenceById.get(id)?.agent === true,
  );
}

export function PeopleArrows({ peers }: { peers: PeerRowsSource }) {
  // Desktop only: a phone's canvas is small and its controls fill the edges.
  const phone = useIsMobileViewport();
  return phone ? null : <PeopleArrowsLayer peers={peers} />;
}

function PeopleArrowsLayer({ peers }: { peers: PeerRowsSource }) {
  const select = useCallback((rows: RemoteAvatarRow[]) => arrowPeopleFor(peers, rows), [peers]);
  const people = usePeerAvatarSlice(peers, select, samePeople);
  const store = useViewportStore();
  const layerRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<PeopleArrowsEngine | null>(null);
  const latestPeers = useLatest(peers);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const made = createPeopleArrowsEngine(layer, {
      view: store.get,
      feetOf: (id) => {
        const row = readPeerAvatarRows(latestPeers.current).find((r) => r.id === id);
        return row ? { x: row.avatar.x, y: row.avatar.y } : null;
      },
      reduced: prefersReducedMotion,
    });
    setEngine(made);
    const offView = store.subscribe(made.wake);
    const offPeers = latestPeers.current.motion.avatars.subscribe(made.wake);
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(made.remeasure);
    observer?.observe(layer);
    window.addEventListener('resize', made.remeasure);
    return () => {
      offView();
      offPeers();
      observer?.disconnect();
      window.removeEventListener('resize', made.remeasure);
      made.dispose();
    };
  }, [store, latestPeers]);

  // A new roster or tab moves nobody, but may change who is where: look again.
  useEffect(() => engine?.wake(), [engine, peers]);

  // Pressing an arrow centres that person, at the zoom you have (reduced motion: at once).
  const centreOn = useCallback(
    (id: string) => {
      const layer = layerRef.current;
      const row = readPeerAvatarRows(latestPeers.current).find((r) => r.id === id);
      if (!layer || !row) return;
      const body = bodyOf(row.avatar);
      const from = store.get();
      glideViewport(
        from,
        {
          zoom: from.zoom,
          offset: { x: layer.clientWidth / 2 - body.x, y: layer.clientHeight / 2 - body.y },
        },
        { zoom: store.setZoom, offset: store.setOffset },
      );
    },
    [store, latestPeers],
  );

  return (
    <div
      ref={layerRef}
      data-people-arrows=""
      // Over the canvas, under the controls (same layer, earlier in the page), so a popover still wins.
      className="pointer-events-none absolute inset-0 z-[var(--z-panel)] overflow-hidden"
    >
      {engine
        ? people.map((person) => (
            <PersonArrow key={person.id} person={person} engine={engine} onPress={centreOn} />
          ))
        : null}
    </div>
  );
}

function PersonArrow({
  person,
  engine,
  onPress,
}: {
  person: ArrowPerson;
  engine: PeopleArrowsEngine;
  onPress: (id: string) => void;
}) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [fresh, setFresh] = useState(true);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const tip = tipRef.current;
    if (!root || !tip) return;
    const node: ArrowNode = { root, tip };
    engine.attach(person.id, node);
    return () => engine.attach(person.id, null);
  }, [engine, person.id]);

  useEffect(() => {
    const t = window.setTimeout(() => setFresh(false), FRESH_MS);
    return () => window.clearTimeout(t);
  }, []);

  const initials = initialsOf(person.name);
  return (
    <Tooltip label={person.name}>
      <button
        ref={rootRef}
        type="button"
        aria-label={`Show ${person.name}`}
        aria-hidden="true"
        tabIndex={-1}
        data-people-arrow={person.id}
        data-fresh={fresh ? 'true' : 'false'}
        onClick={() => onPress(person.id)}
        className="lh-people-arrow pointer-events-none absolute left-0 top-0 origin-center cursor-pointer rounded-full outline-none will-change-transform focus-visible:ring-2 focus-visible:ring-sky-400"
        style={{ width: ARROW_SIZE, height: ARROW_SIZE, opacity: 0, ...identityVars(person.color) }}
      >
        <span className="lh-people-arrow-lift absolute inset-0 block">
          {/* The teardrop turns to face the person; the nudge runs along its point. */}
          <span ref={tipRef} className="absolute inset-0 block">
            <span className="lh-people-arrow-nudge absolute inset-0 block">
              <svg
                viewBox="-19 -19 38 38"
                width={ARROW_SIZE}
                height={ARROW_SIZE}
                aria-hidden="true"
                className="block overflow-visible"
              >
                <path
                  d="M 17.5 0 L 8.2 -8.7 A 12 12 0 1 0 8.2 8.7 Z"
                  className="fill-(--identity) dark:fill-(--identity-deep)"
                  stroke="#ffffff"
                  strokeWidth={2.25}
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
          {/* Their initials, upright in the head, as their avatar chip shows them. */}
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold leading-none tracking-tight text-[color:var(--identity-ink)] dark:text-[color:var(--identity-deep-ink)]">
            {initials}
          </span>
        </span>
      </button>
    </Tooltip>
  );
}
