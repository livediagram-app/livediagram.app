// The Undo and redo card art: a page with two paragraphs on it. Yours is dragged across the page and
// undone back to where it was; the paragraph a teammate is writing below it stays as they left it,
// because undo rewinds only your own edits. Moves on the shared 6s fa-b-* loop
// (app/feature-art/features.css); under reduced motion it shows the undone page.

import {
  Pointer,
  to,
  UndoCluster,
  UndoTip,
  VIEW,
} from '@liveworkspace/marketing-site/components/feature-art/features-parts';
import { INK, Lines, Page } from '@liveworkspace/marketing-site/components/feature-art/page-kit';
import { Frame, PINK, SKY } from '@liveworkspace/marketing-site/components/feature-art/shared';

// Your paragraph's box, where it starts, and the drag that undo takes back.
const MINE = { x: 47, y: 25, w: 62, h: 16 };
const DRAG = { x: 70, y: 0 };
// Where your pointer grabs the paragraph, and the undo button it presses after.
const GRAB = { x: 82, y: 35 };
const UNDO = { x: 252, y: 70 };

/** Undo that is yours alone: your paragraph steps back, a teammate's writing beside it stays. */
export function UndoRedoArt() {
  return (
    <Frame canvas>
      <svg viewBox={VIEW} className="absolute inset-0 h-full w-full">
        <Page x={40} y={7} w={150} h={84}>
          <text x="50" y="19" fontSize="7" fontWeight="700" className={INK} fill="#1e293b">
            Launch Notes
          </text>

          {/* A teammate's paragraph, still being written, untouched by your undo. */}
          <rect
            className="fill-pink-50 stroke-pink-400 dark:fill-pink-500/15 dark:stroke-pink-400"
            x="47"
            y="49"
            width="134"
            height="23"
            rx="2"
            strokeWidth="0.9"
          />
          <Lines x={50} y={52} w={128} count={5} className="fill-slate-300 dark:fill-slate-500" />
          <rect x="130.6" y="66.6" width="0.9" height="4.4" fill={PINK} />
          <g transform="translate(158 70)">
            <Pointer color={PINK} name="JR" />
          </g>

          {/* Where your paragraph sat, and the paragraph: dragged across, then undone back. */}
          <rect
            className="stroke-slate-400 dark:stroke-slate-500"
            x={MINE.x}
            y={MINE.y}
            width={MINE.w}
            height={MINE.h}
            rx="2"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
          <g className="fa-b-drag" style={to(DRAG.x, DRAG.y)}>
            <rect
              className="fill-white dark:fill-slate-800"
              x={MINE.x}
              y={MINE.y}
              width={MINE.w}
              height={MINE.h}
              rx="2"
              fill="#ffffff"
              stroke={SKY}
              strokeWidth="0.9"
            />
            <Lines
              x={MINE.x + 3}
              y={MINE.y + 3.4}
              w={MINE.w - 6}
              count={3}
              className="fill-slate-300 dark:fill-slate-500"
            />
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
