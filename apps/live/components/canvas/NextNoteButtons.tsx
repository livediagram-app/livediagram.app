'use client';

import { useState } from 'react';
import {
  ES_NOTE_GAP,
  eventStormingKindOf,
  eventStormingNote,
  nextNoteBounds,
  nextNoteSides,
  type Element,
  type EsSide,
  type EventStormingNoteKind,
} from '@livediagram/diagram';
import { NoteGhost } from '@/components/canvas/NoteGhost';

// The next-note buttons (spec/139 Phase 7): on each side of the SELECTED note
// that has a next note in the notation, a small tab in that next note's colour
// peeks from the edge. Pointing at a tab (or focusing it) previews the
// note-to-be where it would land; clicking adds it, open for typing.
//
// Spec/139 retired the four quick-connect pluses on this board as chrome that
// the capture loop never asks for. These are a different animal: at most TWO,
// only on the selected note, and each one is a sentence of the notation ("add
// a command before this domain event") rather than a generic "connect
// something here".

// The tab is sized from the note's HEIGHT, in canvas units, so it scales with
// the note and the zoom and keeps one shape on every kind. Narrow enough to sit
// in the gutter between two notes, so it never lies on the note beside.
const TAB_HEIGHT_RATIO = 0.25;
const TAB_WIDTH_RATIO = 0.06;
// The plus keeps its size however narrow the tab: 6% of the note's height.
const PLUS_RATIO = 0.06;
// The smallest hit target, in SCREEN px, whatever the zoom (WCAG 2.2 target
// size); the tab is the picture, the button can be bigger.
const MIN_HIT_PX = 24;

type Tab = {
  key: string;
  fromId: string;
  side: EsSide;
  next: EventStormingNoteKind;
  name: string;
  // The note's edge the tab peeks from, and its centre line.
  edgeX: number;
  centreY: number;
  tabWidth: number;
  tabHeight: number;
  // Where the next note would land.
  spot: { x: number; y: number; width: number; height: number };
};

const noteLabel = (k: EventStormingNoteKind) => eventStormingNote(k).label;

function tabsFor(elements: Element[], selectedId: string | null): Tab[] {
  const from = selectedId ? elements.find((el) => el.id === selectedId) : undefined;
  if (!from || from.type === 'arrow' || from.locked === true) return [];
  const fromKind = eventStormingKindOf(from);
  if (!fromKind) return [];
  return nextNoteSides(fromKind).map(({ side, next }) => ({
    key: `${from.id}:${side}`,
    fromId: from.id,
    side,
    next,
    name: `Add a ${noteLabel(next).toLowerCase()} ${side} this ${noteLabel(fromKind).toLowerCase()}`,
    edgeX: side === 'before' ? from.x : from.x + from.width,
    centreY: from.y + from.height / 2,
    tabWidth: from.height * TAB_WIDTH_RATIO,
    tabHeight: from.height * TAB_HEIGHT_RATIO,
    spot: nextNoteBounds(from, side, next),
  }));
}

export function NextNoteButtons({
  elements,
  selectedId,
  editingId,
  blocked,
  zoom,
  onAdd,
}: {
  elements: Element[];
  selectedId: string | null;
  // The note open for typing, if any. The tabs stand down while the selected
  // note is being typed in, and come back when typing ends.
  editingId: string | null;
  // No buttons where the add would be refused anyway: a view-only session, a
  // locked tab, a hidden or locked active layer — or any drag in hand, which
  // owns the board while it lasts.
  blocked: boolean;
  zoom: number;
  onAdd: (fromId: string, side: EsSide) => void;
}) {
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  if (blocked || (selectedId !== null && editingId === selectedId)) return null;
  const tabs = tabsFor(elements, selectedId);
  if (tabs.length === 0) return null;
  const previewing = tabs.find((t) => t.key === previewKey) ?? null;
  const minHit = MIN_HIT_PX / zoom;

  return (
    <>
      {previewing ? (
        <NoteGhost
          kind={previewing.next}
          box={previewing.spot}
          px={1 / zoom}
          position="absolute"
          testId="next-note-ghost"
        />
      ) : null}
      {tabs.map((t) => {
        const hitWidth = Math.max(t.tabWidth, minHit);
        const hitHeight = Math.max(t.tabHeight, minHit);
        const outward = t.side === 'after';
        // Rounded on the outside, near-square where it meets the paper.
        const inner = t.tabWidth * 0.2;
        const outer = t.tabWidth * 0.5;
        // Centred in the gutter beside the note.
        const inset = Math.max(0, (ES_NOTE_GAP - t.tabWidth) / 2);
        return (
          <button
            key={t.key}
            type="button"
            title={t.name}
            aria-label={t.name}
            data-next-note={t.side}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerEnter={() => setPreviewKey(t.key)}
            onPointerLeave={() => setPreviewKey((k) => (k === t.key ? null : k))}
            onFocus={() => setPreviewKey(t.key)}
            onBlur={() => setPreviewKey((k) => (k === t.key ? null : k))}
            onClick={(e) => {
              e.stopPropagation();
              setPreviewKey(null);
              onAdd(t.fromId, t.side);
            }}
            className={`group absolute flex items-center focus-visible:outline-none ${
              outward ? 'justify-start' : 'justify-end'
            }`}
            style={{
              left: outward ? t.edgeX : t.edgeX - hitWidth,
              top: t.centreY - hitHeight / 2,
              width: hitWidth,
              height: hitHeight,
            }}
          >
            <span
              aria-hidden
              data-next-note-tab={t.side}
              className="flex items-center justify-center overflow-visible text-slate-800/80 opacity-50 ring-1 ring-black/5 transition duration-150 group-hover:text-slate-900 group-hover:opacity-100 group-hover:shadow-sm group-focus-visible:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-brand-500"
              style={{
                width: t.tabWidth,
                height: t.tabHeight,
                ...(outward ? { marginLeft: inset } : { marginRight: inset }),
                background: eventStormingNote(t.next).fill,
                borderRadius: outward
                  ? `${inner}px ${outer}px ${outer}px ${inner}px`
                  : `${outer}px ${inner}px ${inner}px ${outer}px`,
              }}
            >
              <svg
                aria-hidden
                width={t.tabHeight * (PLUS_RATIO / TAB_HEIGHT_RATIO)}
                height={t.tabHeight * (PLUS_RATIO / TAB_HEIGHT_RATIO)}
                className="shrink-0"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M8 3v10M3 8h10"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </button>
        );
      })}
    </>
  );
}
