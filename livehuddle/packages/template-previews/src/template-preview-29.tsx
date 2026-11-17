import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { Plant } from './template-preview-23';
import { Arrival, Bar, POD, RUG, Stools, WOOD } from './template-preview-24';
import { Blocks, Podium, Rooms, Seats, site, Stage, type Site } from './template-preview-25';
import { Floor } from './template-preview-26';

// Group 29: the four Spaces Work Tracker 1076 added (docs/specs/012-collaboration/virtual-office-template.md
// "Interview Suite and Client Lounge", "Classroom and Hackathon Hall"): buildings of closed rooms off an open floor,
// drawn as group 26 draws its buildings, in the template's own canvas px scaled onto the 80 x 50 tile: the floor inside
// an outline open at the entrance, each room with its doorway, and the pieces that make each room what it is. Each hover
// story: a character walks in at the entrance.

const SCREEN = 'rgb(51 65 85)';
const CORK = 'rgb(217 160 92)';
const CLOCK = 'rgb(254 243 199)';
const CARPET = 'rgb(226 230 238)';
const PARQUET = 'rgb(234 218 192)';
const TILES = 'rgb(229 231 235)';
const CONCRETE = 'rgb(214 211 209)';

type Rect = readonly [number, number, number, number];

// A sofa on its rug: the rug an oval, the sofa a block on it.
const Lounge = ({ s, at }: { s: Site; at: readonly (readonly [number, number])[] }) => (
  <>
    {at.map(([x, y]) => (
      <ellipse
        key={`${x}-${y}`}
        cx={s.X(x + 100)}
        cy={s.Y(y + 60)}
        rx={s.L(100)}
        ry={s.L(60)}
        fill={RUG}
      />
    ))}
    <Blocks s={s} at={at.map(([x, y]) => [x + 24, y + 20, 152, 85] as const)} />
  </>
);

// --- Interview Suite: three closed rooms along the top, the waiting area and the front desk below.
function interviewSuite(): ReactElement {
  const s = site(1800, 1000);
  const rooms = [60, 640, 1220];
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={CARPET} door={900} />
      <Rooms s={s} rooms={rooms.map((x) => [x, 60, 520, 400, 'bottom'] as const)} />
      <Blocks s={s} at={rooms.map((x) => [x + 200, 64, 120, 75] as const)} fill={SCREEN} />
      <Blocks
        s={s}
        at={[
          ...rooms.slice(0, 2).map((x) => [x + 144, 170, 232, 168] as const),
          [1340, 170, 232, 168],
        ]}
      />
      <Blocks s={s} at={[[1604, 104, 128, 88]]} fill={SCREEN} />
      <Blocks s={s} at={[[60, 640, 176, 128]]} fill={CORK} />
      <Lounge
        s={s}
        at={[
          [260, 660],
          [540, 660],
        ]}
      />
      <Blocks s={s} at={[[1240, 640, 168, 72]]} fill={CLOCK} />
      <Blocks s={s} at={[[1660, 640, 80, 136]]} fill={POD} />
      <Blocks s={s} at={[[560, 860, 200, 112]]} fill={WOOD} />
      <Plant x={s.X(60)} y={s.Y(940)} />
      <Plant x={s.X(1720)} y={s.Y(940)} />
      <Arrival x={s.X(900)} y={s.Y(940)} />
    </svg>
  );
}

// --- Client Lounge: the boardroom, the glass pitch room and the quiet room along the top, the lounge and bar below.
function clientLounge(): ReactElement {
  const s = site(1960, 1160);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={PARQUET} door={980} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 760, 480, 'bottom'],
          [880, 60, 480, 400, 'bottom'],
          [1420, 60, 480, 400, 'bottom'],
        ]}
      />
      <Blocks
        s={s}
        at={[
          [344, 64, 192, 120],
          [1040, 64, 160, 100],
        ]}
        fill={SCREEN}
      />
      <Blocks
        s={s}
        at={[
          [160, 260, 560, 168],
          [1004, 220, 232, 168],
        ]}
      />
      <Blocks
        s={s}
        at={[
          [1520, 120, 80, 136],
          [1616, 120, 80, 136],
          [1700, 120, 176, 144],
        ]}
        fill={POD}
      />
      <Lounge
        s={s}
        at={[
          [100, 760],
          [396, 760],
        ]}
      />
      <Bar x={s.X(1500)} y={s.Y(700)} w={s.L(240)} />
      <Stools xs={[1520, 1580, 1640, 1700].map(s.X)} y={s.Y(840)} />
      <Blocks s={s} at={[[800, 1000, 200, 112]]} fill={WOOD} />
      <Plant x={s.X(60)} y={s.Y(1100)} />
      <Plant x={s.X(1900)} y={s.Y(1100)} />
      <Arrival x={s.X(980)} y={s.Y(1100)} />
    </svg>
  );
}

// --- Classroom: twelve desks facing the Screen, three breakout rooms down the right, the lobby below.
function classroom(): ReactElement {
  const s = site(2000, 1300);
  const breakouts = [60, 460, 860];
  const desks: Rect[] = [360, 592].flatMap((y) =>
    [140, 276, 412, 660, 796, 932].map((x) => [x, y, 120, 112] as const),
  );
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={TILES} door={1000} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 1040, 760, 'bottom'],
          ...breakouts.map((y) => [1300, y, 640, 340, 'left'] as const),
        ]}
      />
      <Blocks s={s} at={[[100, 100, 176, 128]]} fill={CORK} />
      <Blocks
        s={s}
        at={[[500, 64, 192, 120], ...breakouts.map((y) => [1526, y + 4, 128, 80] as const)]}
        fill={SCREEN}
      />
      <Blocks s={s} at={[[740, 120, 120, 112]]} fill={WOOD} />
      <Blocks s={s} at={desks} />
      <Blocks s={s} at={breakouts.map((y) => [1500, y + 100, 232, 168] as const)} />
      <Plant x={s.X(960)} y={s.Y(1200)} />
      <Arrival x={s.X(1000)} y={s.Y(1230)} />
    </svg>
  );
}

// --- Hackathon Hall: the Main Stage, the mentor and nap rooms and the snack bar, team tables on the hack floor.
function hackathonHall(): ReactElement {
  const s = site(2200, 1480);
  const tables: Rect[] = [1000, 1290].flatMap((y) =>
    [60, 412, 764].map((x) => [x, y, 232, 168] as const),
  );
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={CONCRETE} door={1100} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 1040, 700, 'bottom'],
          [1180, 60, 480, 360, 'bottom'],
          [1720, 60, 420, 360, 'bottom'],
          [1180, 620, 960, 340, 'bottom'],
        ]}
      />
      <Stage s={s} at={[400, 108, 360, 140]} />
      <Podium s={s} x={670} y={140} />
      <Blocks
        s={s}
        at={[
          [160, 104, 192, 120],
          [808, 104, 192, 120],
        ]}
        fill={SCREEN}
      />
      <Seats s={s} xs={[260, 340, 420, 664, 744, 824]} ys={[360, 564]} />
      <Blocks s={s} at={[[1304, 140, 232, 168], ...tables]} />
      <Blocks
        s={s}
        at={[
          [1760, 120, 120, 112],
          [2000, 120, 120, 112],
        ]}
        fill={POD}
      />
      <Bar x={s.X(1220)} y={s.Y(660)} w={s.L(240)} />
      <Bar x={s.X(1460)} y={s.Y(660)} w={s.L(240)} />
      <Stools xs={[1240, 1360, 1480, 1600].map(s.X)} y={s.Y(800)} />
      <Blocks s={s} at={[[1400, 1250, 176, 128]]} fill={CORK} />
      <circle cx={s.X(1920)} cy={s.Y(1310)} r={s.L(80)} fill={RUG} />
      <Arrival x={s.X(1100)} y={s.Y(1410)} />
    </svg>
  );
}

export function templatePreviewGroup29(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'interview-suite':
      return interviewSuite();
    case 'client-lounge':
      return clientLounge();
    case 'classroom':
      return classroom();
    case 'hackathon-hall':
      return hackathonHall();
    default:
      return null;
  }
}
