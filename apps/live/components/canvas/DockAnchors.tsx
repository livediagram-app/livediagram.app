'use client';

import {
  dockableFaces,
  dockedBounds,
  ES_DOCK_DOT_R,
  eventStormingKindOf,
  eventStormingNote,
  isFaceFree,
  type Element,
  type EsDockSide,
  type EventStormingNoteKind,
} from '@livediagram/diagram';
import { useDockHoveredId } from '@/lib/dock-preview';

// The anchor affordances on a host's FREE dockable faces (spec/139 Phase 7):
// a hollow dot in the seam position, which adds the compatible note already
// docked and open for typing.
//
// Spec/139 retired the four quick-connect pluses on this board as chrome that
// the capture loop never asks for. These are a different animal, and the
// difference is what earns them their place: at most TWO per host, only on the
// host you are pointing at or have selected, and each one is a sentence of the
// notation ("add a command before this event") rather than a generic "connect
// something here".

const DOT_PX = ES_DOCK_DOT_R * 2;
// A comfortable target around a small dot (WCAG 2.2 target size): the dot is
// the picture, this is the button.
const HIT_PX = 24;

function label(kind: EventStormingNoteKind, side: EsDockSide, hostLabel: string): string {
  const where = side === 'before' ? 'before' : 'after';
  return `Add a ${eventStormingNote(kind).label.toLowerCase()} ${where} ${hostLabel}`;
}

export function DockAnchors({
  elements,
  selectedId,
  blocked,
  zoom,
  onAdd,
}: {
  elements: Element[];
  selectedId: string | null;
  // No affordances where the add would be refused anyway: a view-only session,
  // a locked tab, a hidden or locked active layer — or any drag in hand, which
  // owns the board while it lasts.
  blocked: boolean;
  zoom: number;
  onAdd: (hostId: string, side: EsDockSide) => void;
}) {
  const hoveredId = useDockHoveredId();
  if (blocked) return null;

  // Selection and hover both count, and they are the same host often enough
  // that the set matters more than the order.
  const hostIds = [selectedId, hoveredId].filter((id): id is string => id !== null);
  const seen = new Set<string>();

  const anchors: {
    key: string;
    hostId: string;
    side: EsDockSide;
    kind: EventStormingNoteKind;
    x: number;
    y: number;
    name: string;
  }[] = [];

  for (const id of hostIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const host = elements.find((el) => el.id === id);
    if (!host || host.type === 'arrow' || host.locked === true) continue;
    const hostKind = eventStormingKindOf(host);
    if (!hostKind) continue;
    for (const face of dockableFaces(hostKind)) {
      if (!isFaceFree(host.id, face.side, elements)) continue;
      const bounds = dockedBounds(host, face.side, face.kind);
      // Centred in the seam, on the pair's shared centre line.
      const x =
        face.side === 'before'
          ? bounds.x + bounds.width + (host.x - bounds.x - bounds.width) / 2
          : host.x + host.width + (bounds.x - host.x - host.width) / 2;
      anchors.push({
        key: `${host.id}:${face.side}`,
        hostId: host.id,
        side: face.side,
        kind: face.kind,
        x,
        y: host.y + host.height / 2,
        name: label(face.kind, face.side, eventStormingNote(hostKind).label.toLowerCase()),
      });
    }
  }

  if (anchors.length === 0) return null;

  return (
    <>
      {anchors.map((a) => (
        <button
          key={a.key}
          type="button"
          title={a.name}
          aria-label={a.name}
          data-dock-anchor={a.side}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAdd(a.hostId, a.side);
          }}
          className="absolute flex items-center justify-center rounded-full text-slate-500 transition hover:text-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-300 dark:hover:text-brand-300"
          style={{
            // Canvas units: the wrapper is already scaled, so the hit target
            // is divided by zoom to stay a constant 24 SCREEN px.
            left: a.x - HIT_PX / zoom / 2,
            top: a.y - HIT_PX / zoom / 2,
            width: HIT_PX / zoom,
            height: HIT_PX / zoom,
          }}
        >
          <span
            aria-hidden
            className="block rounded-full border-2 border-current bg-transparent"
            style={{ width: (DOT_PX * 2) / zoom, height: (DOT_PX * 2) / zoom }}
          />
        </button>
      ))}
    </>
  );
}
