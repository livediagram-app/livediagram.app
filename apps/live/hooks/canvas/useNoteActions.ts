'use client';

import {
  changeEventStormingKind,
  eventStormingKindOf,
  nextNoteKind,
  type BoxedElement,
  type Element,
  type EsSide,
  type EventStormingNoteKind,
  type Tab,
} from '@livediagram/diagram';
import { buildEventStormingNote } from '@/lib/draw-commit';
import { planNextNote } from '@/lib/next-note-add';
import type { InsertionSlot } from '@/lib/insert-between';
import { track } from '@/lib/telemetry';

// The note acts on an event-storming board (docs/specs/021-event-storming/event-storming.md): add the next note
// beside one (Phase 7), and change a note's kind. Each is ONE undoable step
// through the ordinary commit choke point, so layer stamping, board-kind
// stamping, the activity log, autosave and realtime all happen exactly as they
// do for any other change.
//
// The note is minted through the ONE builder every other entry point uses, so
// its fill, silhouette, tilt, fixed size, auto-fit and layer routing cannot
// drift from a note dropped by hand.

type NoteActionsDeps = {
  activeTab: Tab;
  // The whole creation gate (docs/specs/006-diagram/layers.md): a view-only session, a locked tab, or a
  // hidden / locked active layer. Every act here creates or changes, so all
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

export type NoteActionsApi = {
  addNextNote: (fromId: string, side: EsSide) => void;
  setEsKindOf: (id: string, kind: EventStormingNoteKind) => void;
};

export function useNoteActions({
  activeTab,
  createBlocked,
  layerInertIds,
  commit,
  addBoxedAt,
}: NoteActionsDeps): NoteActionsApi {
  const addNextNote = (fromId: string, side: EsSide) => {
    if (createBlocked) return;
    const from = activeTab.elements.find((el) => el.id === fromId);
    const fromKind = from ? eventStormingKindOf(from) : null;
    if (!fromKind) return;
    // The catalogue decides WHICH note goes on this side; nothing here picks.
    const kind = nextNoteKind(fromKind, side);
    if (!kind) return;
    const plan = planNextNote(activeTab.elements, fromId, side, kind, layerInertIds);
    if (!plan) return;
    track('Canvas', 'Used', 'AddNextNote');
    addBoxedAt(
      plan.bounds.x + plan.bounds.width / 2,
      plan.bounds.y + plan.bounds.height / 2,
      (x, y) => buildEventStormingNote(plan.kind, x, y, activeTab),
      // Opened for typing, because the click already said what and where — and
      // the ripple (if the spot was taken) lands in the SAME commit, so one
      // Undo puts the whole board back.
      { edit: true, insertion: plan.ripple },
    );
    track('Element', 'Added', 'Sticky');
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

  return { addNextNote, setEsKindOf };
}
