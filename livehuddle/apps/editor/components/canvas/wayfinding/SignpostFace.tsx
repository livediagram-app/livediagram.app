'use client';

import { useMemo } from 'react';
import {
  OFFICE_ART,
  SIGNPOST_BOARD_RECTS,
  SIGNPOST_BOARDS,
  SIGNPOST_TIP,
  TEAM_TONES,
  signpostArrowPath,
  type ShapeElement,
} from '@livehuddle/document';
import { HoverCard, Tooltip } from '@livehuddle/ui';
import { Overlay } from '@/components/canvas/collab/SocialFaces';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import {
  signpostBoards,
  signpostFoot,
  tabPlaces,
  type SignpostBoard,
  type SpacePlace,
} from '@/lib/wayfinding';
import { useWayfindingSelect, type Wayfinding, type WayfindingState } from './wayfinding-store';

// The Signpost's face (docs/specs/009-elements/team-pieces.md "Signpost"): its boards turned into arrows naming the
// tab's three nearest places, each a button that walks you there by the Directory's Walk There. The places are the
// Directory's (lib/wayfinding tabPlaces), read from the canvas's wayfinding store; they are worked out again only when
// the tab's elements or the post itself move. A click presses, a drag moves the post (usePressWithoutDrag). While
// walking, a click anywhere on it presses the top board (data-piece-main).

const art = OFFICE_ART.signpost.front;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const EMPTY_TIP = 'No Places Yet: add a room, an office pod or a stage and it appears here.';
// A board's name fits about this many characters at its size; a longer one is cut, the whole in its tooltip.
const NAME_MAX = 13;

function clip(text: string): string {
  return text.length > NAME_MAX ? `${text.slice(0, NAME_MAX - 1).trimEnd()}…` : text;
}

const activeElements = (s: WayfindingState) =>
  s.tabs.find((t) => t.id === s.activeTabId)?.elements ?? null;

export function SignpostFace({
  element,
  wayfinding,
}: {
  element: ShapeElement;
  wayfinding?: Wayfinding;
}) {
  if (!wayfinding) return null;
  return <SignpostBoards element={element} wayfinding={wayfinding} />;
}

function SignpostBoards({
  element,
  wayfinding,
}: {
  element: ShapeElement;
  wayfinding: Wayfinding;
}) {
  const elements = useWayfindingSelect(wayfinding.store, activeElements);
  const tabId = useWayfindingSelect(wayfinding.store, (s) => s.activeTabId);
  const { x, y, width, height } = element;
  const boards = useMemo(
    () =>
      elements
        ? signpostBoards(
            tabPlaces(tabId, elements),
            signpostFoot({ x, y, width, height }),
            SIGNPOST_BOARDS,
          )
        : [],
    [elements, tabId, x, y, width, height],
  );
  if (boards.length === 0)
    return (
      <Overlay element={element}>
        <HoverCard
          block
          className="pointer-events-auto h-full w-full"
          title="Signpost"
          description={EMPTY_TIP}
        >
          <span className="block h-full w-full" aria-label={`Signpost. ${EMPTY_TIP}`} role="img" />
        </HoverCard>
      </Overlay>
    );
  return (
    <Overlay element={element}>
      <svg
        viewBox={`0 0 ${art.width} ${art.height}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        {boards.map((b, i) => {
          const r = SIGNPOST_BOARD_RECTS[i]!;
          const shift = b.dir === 'right' ? 0 : SIGNPOST_TIP / 2;
          return (
            <g key={b.place.id} data-signpost-board={b.dir}>
              <path
                d={signpostArrowPath(i, b.dir)}
                transform={`translate(${b.dir === 'right' ? -SIGNPOST_TIP / 2 : SIGNPOST_TIP / 2} 1.2)`}
                fill="#000"
                opacity={0.14}
              />
              <path
                d={signpostArrowPath(i, b.dir)}
                transform={`translate(${b.dir === 'right' ? -SIGNPOST_TIP / 2 : SIGNPOST_TIP / 2} 0)`}
                fill={TEAM_TONES.board}
                stroke={TEAM_TONES.woodDeep}
                strokeWidth={1.2}
                strokeLinejoin="round"
              />
              <circle cx={art.width / 2} cy={r.y + r.h / 2} r={1.3} fill={TEAM_TONES.nail} />
              <text
                x={r.x + r.w / 2 - SIGNPOST_TIP / 2 + shift}
                y={r.y + r.h / 2 + 3.3}
                textAnchor="middle"
                fontSize={9}
                fontWeight={700}
                fill="#451a03"
              >
                {clip(b.place.name)}
              </text>
            </g>
          );
        })}
      </svg>
      {boards.map((b, i) => (
        <BoardButton key={b.place.id} board={b} index={i} wayfinding={wayfinding} />
      ))}
    </Overlay>
  );
}

function BoardButton({
  board,
  index,
  wayfinding,
}: {
  board: SignpostBoard;
  index: number;
  wayfinding: Wayfinding;
}) {
  const r = SIGNPOST_BOARD_RECTS[index]!;
  const place: SpacePlace = board.place;
  const press = usePressWithoutDrag(() => wayfinding.actions.walkThere(place));
  // The board and its tip, where the arrow is drawn: either way it spans the same width, shifted half a tip.
  const left = r.x - SIGNPOST_TIP / 2;
  return (
    <Tooltip label={`Walk to ${place.name}`}>
      <button
        type="button"
        aria-label={`Walk to ${place.name}`}
        {...press}
        {...(index === 0 ? { 'data-piece-main': '' } : null)}
        className="pointer-events-auto absolute cursor-pointer rounded-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-sky-500"
        style={{
          left: pct(left, art.width),
          top: pct(r.y, art.height),
          width: pct(r.w + SIGNPOST_TIP, art.width),
          height: pct(r.h, art.height),
        }}
      />
    </Tooltip>
  );
}
