// The Undo and redo card art: a logo page with its mark and wordmark. Your mark layer is dragged off
// centre and undone back to where it was; the wordmark a teammate is editing stays as they left it,
// because undo rewinds only your own edits. Moves on the shared 6s fa-b-* loop
// (app/feature-art/features.css); under reduced motion it shows the undone artboard.

import {
  Pointer,
  to,
  UndoCluster,
  UndoTip,
  VIEW,
} from '@liveworkspace/marketing-site/components/feature-art/features-parts';
import {
  INK,
  Page,
  PageLabel,
  VIOLET,
} from '@liveworkspace/marketing-site/components/feature-art/page-kit';
import { Frame, PINK, SKY } from '@liveworkspace/marketing-site/components/feature-art/shared';

// The square artboard and the centre the mark sits on.
const BOARD = { x: 46, y: 10, size: 80 };
const CX = BOARD.x + BOARD.size / 2;
const CY = BOARD.y + 30;
// One half of the mark, a petal from its base to its tip round (0, 0); a mirror draws its twin.
const PETAL = 'M0 18 C-17 8 -15 -12 0 -18';
// The mark layer's box, the drag that undo takes back, where your pointer grabs it, and the undo
// button it presses after.
const MINE = { x: CX - 13, y: CY - 14, w: 26, h: 28 };
const DRAG = { x: 24, y: 0 };
const GRAB = { x: CX + 2, y: CY + 2 };
const UNDO = { x: 252, y: 70 };

/** Undo that is yours alone: your mark steps back, a teammate's wordmark beside it stays. */
export function UndoRedoArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        <PageLabel x={BOARD.x} y={BOARD.y - 2.5}>
          Logo
        </PageLabel>
        <Page x={BOARD.x} y={BOARD.y} w={BOARD.size} h={BOARD.size}>
          {/* The wordmark, being edited by a teammate, untouched by your undo. */}
          <rect
            className="fill-pink-50 stroke-pink-400 dark:fill-pink-500/15 dark:stroke-pink-400"
            x={CX - 22}
            y={BOARD.y + 65}
            width="44"
            height="10"
            rx="1.5"
            strokeWidth="0.9"
          />
          <text
            className={INK}
            x={CX}
            y={BOARD.y + 72.3}
            textAnchor="middle"
            fontSize="6.4"
            fontWeight="800"
            letterSpacing="1.6"
            fill="#1e293b"
          >
            BRAND
          </text>
          <g transform={`translate(${CX + 24} ${BOARD.y + 64})`}>
            <Pointer color={PINK} name="JR" />
          </g>

          {/* Where the mark sat, and the mark layer: dragged off centre, then undone back. */}
          <rect
            className="stroke-slate-400 dark:stroke-slate-500"
            x={MINE.x}
            y={MINE.y}
            width={MINE.w}
            height={MINE.h}
            rx="1.5"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
          <g className="fa-b-drag" style={to(DRAG.x, DRAG.y)}>
            <rect
              x={MINE.x}
              y={MINE.y}
              width={MINE.w}
              height={MINE.h}
              rx="1.5"
              fill="none"
              stroke={SKY}
              strokeWidth="0.9"
            />
            <g transform={`translate(${CX} ${CY}) scale(0.62)`}>
              {[undefined, 'scale(-1 1)'].map((transform, i) => (
                <path
                  key={i}
                  d={PETAL}
                  transform={transform}
                  fill="none"
                  stroke={SKY}
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              ))}
              <circle r="5" fill={VIOLET} />
            </g>
          </g>
        </Page>

        <UndoCluster x={242} y={62} />
        <g
          className="fa-b-undo"
          style={to(DRAG.x, DRAG.y, {
            '--ux': `${UNDO.x - GRAB.x}px`,
            '--uy': `${UNDO.y - GRAB.y}px`,
          })}
        >
          <g transform={`translate(${GRAB.x} ${GRAB.y})`}>
            <Pointer color={SKY} name="You" />
          </g>
        </g>
        <UndoTip x={212} y={46} />
      </svg>
    </Frame>
  );
}
