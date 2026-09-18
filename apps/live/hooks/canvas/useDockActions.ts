'use client';

import {
  changeEventStormingKind,
  dock,
  dockKindForFace,
  eventStormingKindOf,
  isFaceFree,
  undock as undockIn,
  type BoxedElement,
  type Element,
  type EsDockSide,
  type EventStormingNoteKind,
  type Tab,
} from '@livediagram/diagram';
import { buildEventStormingNote } from '@/lib/draw-commit';
import { planDockAdd } from '@/lib/dock-add';
import type { InsertionSlot } from '@/lib/insert-between';
import { track } from '@/lib/telemetry';

// The three acts of anchor docking (spec/139 Phase 7): add a note already
// docked to a host's free face, dock a note that is already on the board, and
// undock one. Each is ONE undoable step through the ordinary commit choke
// point, so layer stamping, board-kind stamping, the activity log, autosave
// and realtime all happen exactly as they do for any other change.
//
// The note is minted through the ONE builder every other entry point uses, so
// its fill, silhouette, tilt, fixed size, auto-fit and layer routing cannot
// drift from a note dropped by hand — the rule this board has already paid to
// learn twice.

type DockActionsDeps = {
  activeTab: Tab;
  // The whole creation gate (spec/74): a view-only session, a locked tab, or a
  // hidden / locked active layer. Every act here creates or moves, so all
  // three refuse.
  createBlocked: boolean;
  layerInertIds: ReadonlySet<string>;
  commit: (mapper: (els: Element[]) => Element[]) => void;
  addBoxedAt: <T extends BoxedElement>(
    canvasX: number,
    canvasY: number,
    make: (x: number, y: number) => T,
    opts?: { edit?: boolean; insertion?: InsertionSlot | null },
  ) => void;
};

export type DockActionsApi = {
  addDockedNote: (hostId: string, side: EsDockSide) => void;
  dockTo: (id: string, hostId: string, side: EsDockSide) => void;
  undock: (id: string) => void;
  // Change a note's KIND (spec/139): a verb on this board, and it lives here
  // because it is the same kind of act as docking — notation, not styling.
  setEsKindOf: (id: string, kind: EventStormingNoteKind) => void;
};

export function useDockActions({
  activeTab,
  createBlocked,
  layerInertIds,
  commit,
  addBoxedAt,
}: DockActionsDeps): DockActionsApi {
  const addDockedNote = (hostId: string, side: EsDockSide) => {
    if (createBlocked) return;
    const host = activeTab.elements.find((el) => el.id === hostId);
    const hostKind = host ? eventStormingKindOf(host) : null;
    if (!hostKind) return;
    // The catalogue decides WHICH note this face takes; nothing here picks.
    const kind = dockKindForFace(hostKind, side);
    if (!kind) return;
    // One note per face. The affordance is only offered on a FREE one, but a
    // peer can take it between the render and the click, and the keyboard
    // path reaches the same act — so the act itself is where this is decided.
    if (!isFaceFree(hostId, side, activeTab.elements)) return;
    const plan = planDockAdd(activeTab.elements, hostId, side, kind, layerInertIds);
    if (!plan) return;
    track('Canvas', 'Used', 'DockAdd');
    addBoxedAt(
      plan.bounds.x + plan.bounds.width / 2,
      plan.bounds.y + plan.bounds.height / 2,
      (x, y) => ({
        ...buildEventStormingNote(plan.kind, x, y, activeTab),
        esDock: { hostId, side },
      }),
      // Opened for typing, because the click already said what and where — and
      // the ripple (if the spot was taken) lands in the SAME commit, so one
      // Undo puts the whole board back.
      { edit: true, insertion: plan.ripple },
    );
    track('Element', 'Added', 'Sticky');
  };

  const dockTo = (id: string, hostId: string, side: EsDockSide) => {
    if (createBlocked) return;
    // Same rule from the drag path: a face holds one note.
    if (!isFaceFree(hostId, side, activeTab.elements)) return;
    track('Canvas', 'Used', 'Dock');
    commit((els) => dock(els, id, hostId, side));
  };

  const undock = (id: string) => {
    if (createBlocked) return;
    track('Canvas', 'Used', 'Undock');
    commit((els) => undockIn(els, id));
  };

  const setEsKindOf = (id: string, kind: EventStormingNoteKind) => {
    if (createBlocked) return;
    track('Canvas', 'Used', 'ChangeNoteKind');
    commit((els) =>
      els.map((el) =>
        el.id === id && el.type === 'sticky' ? changeEventStormingKind(el, kind) : el,
      ),
    );
  };

  return { addDockedNote, dockTo, undock, setEsKindOf };
}
