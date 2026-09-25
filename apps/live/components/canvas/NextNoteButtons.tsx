'use client';

import { useState } from 'react';
import {
  eventStormingKindOf,
  eventStormingNote,
  nextNoteBounds,
  nextNoteSides,
  type Element,
  type EsSide,
  type EventStormingNoteKind,
} from '@livediagram/diagram';

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
// the note and the zoom and keeps one shape on every kind.
const TAB_HEIGHT_RATIO = 0.25;
const TAB_WIDTH_RATIO = 0.1;
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
  blocked,
  zoom,
  onAdd,
}: {
  elements: Element[];
  selectedId: string | null;
  // No buttons where the add would be refused anyway: a view-only session, a
  // locked tab, a hidden or locked active layer — or any drag in hand, which
  // owns the board while it lasts.
  blocked: boolean;
  zoom: number;
  onAdd: (fromId: string, side: EsSide) => void;
}) {
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  if (blocked) return null;
  const tabs = tabsFor(elements, selectedId);
  if (tabs.length === 0) return null;
  const previewing = tabs.find((t) => t.key === previewKey) ?? null;
  const minHit = MIN_HIT_PX / zoom;

  return (
    <>
      {previewing ? <NextNoteGhost tab={previewing} zoom={zoom} /> : null}
      {tabs.map((t) => {
        const hitWidth = Math.max(t.tabWidth, minHit);
        const hitHeight = Math.max(t.tabHeight, minHit);
        const outward = t.side === 'after';
        // Rounded on the outside, near-square where it meets the paper.
        const inner = t.tabWidth * 0.2;
        const outer = t.tabWidth * 0.5;
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
              className="flex items-center justify-center text-slate-800/80 opacity-70 shadow-sm ring-1 ring-black/10 transition duration-150 group-hover:text-slate-900 group-hover:opacity-100 group-hover:shadow group-focus-visible:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-brand-500"
              style={{
                width: t.tabWidth,
                height: t.tabHeight,
                background: eventStormingNote(t.next).fill,
                borderRadius: outward
                  ? `${inner}px ${outer}px ${outer}px ${inner}px`
                  : `${outer}px ${inner}px ${inner}px ${outer}px`,
              }}
            >
              <svg
                aria-hidden
                width={t.tabWidth * 0.6}
                height={t.tabWidth * 0.6}
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

// The note-to-be, drawn where it would land: a dashed outline in its own
// colour with its kind named inside. Only a picture; nothing on the board
// moves until the click.
function NextNoteGhost({ tab, zoom }: { tab: Tab; zoom: number }) {
  const fill = eventStormingNote(tab.next).fill;
  const { spot } = tab;
  return (
    <div
      aria-hidden
      data-testid="next-note-ghost"
      className="pointer-events-none absolute flex flex-col items-center justify-center font-semibold"
      style={{
        left: spot.x,
        top: spot.y,
        width: spot.width,
        height: spot.height,
        border: `${2 / zoom}px dashed ${fill}`,
        borderRadius: spot.height * 0.03,
        background: `${fill}2e`,
        color: fill,
        fontSize: spot.height * 0.075,
        gap: spot.height * 0.02,
      }}
    >
      <svg
        aria-hidden
        width={spot.height * 0.12}
        height={spot.height * 0.12}
        viewBox="0 0 16 16"
        fill="none"
      >
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {noteLabel(tab.next)}
    </div>
  );
}
