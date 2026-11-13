import { at, TEAMMATE, YOU } from '@/components/art-tokens';
import { CursorMark } from '@liveworkspace/marketing-site/components/hero-cursor';
import { cursorRide, type Point } from '@/lib/hero-motion';
import { Heading, type Box } from './hero-townhall-parts';
import {
  Agenda,
  Applause,
  FollowUps,
  OnThePanel,
  PanelRow,
  Poll,
  Timer,
  Title,
  type KitLayout,
} from './hero-townhall-kit';
import { QaBoard, rowCentre, rowY } from './hero-townhall-qa';

// The hero's Town Hall window (docs/specs/019-marketing/marketing-site.md "Hero"): the app's Town
// Hall Q&A template (packages/templates template-builders-town-hall.ts) running live, laid out as
// the template lays it out. The title and its microphone sticker over three columns: On the panel
// over the Run of show on the left; the Q&A board in the middle (docs/specs/012-collaboration/
// qa-board.md); the Facilitator kit (timer, applause pad, poll) over the Follow-ups on the right.
// On the board a question is typed and lands with three more, votes tick up (a teammate's among
// them), the most wanted rises to the top, and the host puts it in the spotlight (Now discussing),
// marks it done (it folds into Discussed) and spotlights the next. Meanwhile the timer runs, the
// room's applause floats up, the poll fills and a follow-up is ticked off. A phone stacks the
// board over the kit. Each piece arrives at its own --d delay (hero-mode-animations.css,
// hero-scenes/townhall.css).

type Layout = KitLayout & {
  board: Box;
  rowH: number;
  question: number;
  // The cursors' stops: the teammate votes and claps, you start the timer and run the board.
  mate: Point[];
  you: Point[];
};

// Columns as the template lays them out, widened into the window's spare width (the landscape
// viewBox runs -24..624 wide in every window that draws it).
const LANDSCAPE_BOARD: Box = { x: 150, y: -8, w: 292, h: 306 };
const LANDSCAPE: Layout = {
  title: { x: -20, y: -36, size: 17, sticker: 26 },
  panel: { x: -20, y: 12, w: 158, cardH: 32 },
  agenda: { x: -20, y: 150, w: 158, h: 182 },
  timer: { x: 454, y: 12, w: 82, h: 46 },
  applause: { x: 542, y: 12, w: 82, h: 46 },
  poll: { x: 454, y: 66, w: 170, h: 100 },
  follow: { x: 454, y: 202, w: 170, h: 92, caption: true },
  board: LANDSCAPE_BOARD,
  rowH: 57,
  question: 11,
  mate: [
    [640, 340],
    [LANDSCAPE_BOARD.x + 30, rowCentre(LANDSCAPE_BOARD, 57, 1) + 4],
    [585, 40],
    [660, 120],
  ],
  you: [
    [300, -70],
    [526, 35],
    [LANDSCAPE_BOARD.x + LANDSCAPE_BOARD.w - 52, rowY(LANDSCAPE_BOARD, 0, 57) + 14],
    [LANDSCAPE_BOARD.x + LANDSCAPE_BOARD.w - 29, rowY(LANDSCAPE_BOARD, 0, 57) + 14],
    [LANDSCAPE_BOARD.x + LANDSCAPE_BOARD.w - 52, rowY(LANDSCAPE_BOARD, 0, 57) + 14],
    [LANDSCAPE_BOARD.x + LANDSCAPE_BOARD.w - 70, rowY(LANDSCAPE_BOARD, 0, 57) + 40],
  ],
};

const PORTRAIT_BOARD: Box = { x: 0, y: 30, w: 360, h: 300 };
const PORTRAIT: Layout = {
  title: { x: 2, y: -24, size: 15, sticker: 22 },
  panelRow: { x: 2, y: -10 },
  timer: { x: 0, y: 342, w: 112, h: 52 },
  applause: { x: 120, y: 342, w: 96, h: 52 },
  poll: { x: 224, y: 342, w: 136, h: 82 },
  follow: { x: 0, y: 402, w: 216, h: 74, caption: false },
  board: PORTRAIT_BOARD,
  rowH: 56,
  question: 12,
  mate: [
    [380, 400],
    [PORTRAIT_BOARD.x + 30, rowCentre(PORTRAIT_BOARD, 56, 1) + 4],
    [170, 362],
    [390, 300],
  ],
  you: [
    [200, -60],
    [96, 368],
    [PORTRAIT_BOARD.x + PORTRAIT_BOARD.w - 52, rowY(PORTRAIT_BOARD, 0, 56) + 14],
    [PORTRAIT_BOARD.x + PORTRAIT_BOARD.w - 29, rowY(PORTRAIT_BOARD, 0, 56) + 14],
    [PORTRAIT_BOARD.x + PORTRAIT_BOARD.w - 52, rowY(PORTRAIT_BOARD, 0, 56) + 14],
    [PORTRAIT_BOARD.x + PORTRAIT_BOARD.w - 70, rowY(PORTRAIT_BOARD, 0, 56) + 40],
  ],
};

export function TownHallBoard({ portrait = false }: { portrait?: boolean }) {
  const L = portrait ? PORTRAIT : LANDSCAPE;
  return (
    <>
      <Title {...L.title} />
      {L.panel ? <OnThePanel {...L.panel} /> : null}
      {L.panelRow ? <PanelRow {...L.panelRow} /> : null}
      {L.agenda ? <Agenda box={L.agenda} /> : null}
      <QaBoard L={L} />
      {portrait ? null : (
        <g className="hm-fade" style={at(0.8)}>
          <Heading x={L.timer.x} y={L.timer.y - 10}>
            Facilitator kit
          </Heading>
        </g>
      )}
      <Timer box={L.timer} portrait={portrait} />
      <Applause box={L.applause} />
      <Poll box={L.poll} />
      <FollowUps box={L.follow} caption={L.follow.caption} />
      <Cursor className="th-mate" colour={TEAMMATE} name="JR" ride={L.mate} />
      <Cursor className="th-you" colour={YOU} name="TM" ride={L.you} />
    </>
  );
}

function Cursor({
  className,
  colour,
  name,
  ride,
}: {
  className: string;
  colour: string;
  name: string;
  ride: readonly Point[];
}) {
  return (
    <g className={className} style={cursorRide(ride)} aria-hidden>
      <CursorMark colour={colour} label={name} />
    </g>
  );
}
