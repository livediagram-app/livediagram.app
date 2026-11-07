import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { Plant, WALL } from './template-preview-23';
import { Arrival, Bar, PATH, POD, RUG, Stools, Tree, WOOD } from './template-preview-24';
import {
  Blocks,
  Lawn,
  Paths,
  Rooms,
  Seats,
  site,
  Stage,
  Curtains,
  Podium,
  SwimmingPool,
  Water,
  type Site,
} from './template-preview-25';

// Group 26: the five Spaces after the first Campus ones (docs/specs/012-collaboration/virtual-office-template.md
// "Campus Spaces", "Spaces with floors" and "More Spaces"): the School Quad, the Hotel and Suites and the Co-working
// Tower (their first floors), the Expo Hall and the Beach Offsite. Drawn as group 25 draws its sites, in the template's
// own canvas px scaled onto the 80 x 50 tile. A building's floor is its own floor colour inside an outline; the beach is
// sand. Each hover story: a character walks in at the gate or the entrance.

const SAND = 'rgb(250 232 180)';
const MARBLE = 'rgb(236 232 226)';
const WOOD_FLOOR = 'rgb(234 218 192)';
const CONCRETE = 'rgb(214 211 209)';
const STEEL = 'rgb(148 163 184)';
const FIRE = 'rgb(249 115 22)';
const UMBRELLA = 'rgb(248 113 113)';

// A building's floor: its colour, inside an outline open at the entrance in the bottom wall.
function Floor({ s, fill, door }: { s: Site; fill: string; door?: number }) {
  const [l, t, r, b] = [s.X(0), s.Y(0), s.X(s.width), s.Y(s.height)];
  return (
    <>
      <rect x={l} y={t} width={r - l} height={b - t} rx="1" fill={fill} />
      <path
        d={
          door === undefined
            ? `M${l} ${t}H${r}V${b}H${l}Z`
            : `M${s.X(door - 72)} ${b}H${l}V${t}H${r}V${b}H${s.X(door + 72)}`
        }
        fill="none"
        stroke={WALL}
        strokeWidth="0.5"
      />
    </>
  );
}

// A round plaza or junction, centred on (x, y).
const Round = ({ s, x, y, d }: { s: Site; x: number; y: number; d: number }) => (
  <circle cx={s.X(x)} cy={s.Y(y)} r={s.L(d / 2)} fill={PATH} />
);

const Fountain = ({ s, x, y }: { s: Site; x: number; y: number }) => (
  <circle cx={s.X(x)} cy={s.Y(y)} r="1.6" fill="rgb(186 230 253)" stroke={WALL} strokeWidth="0.3" />
);

// --- School Quad: classrooms down the left, the lecture hall across the top, the library and canteen on the right.
function schoolQuad(): ReactElement {
  const s = site(2300, 1460);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Lawn s={s} gate={1150} />
      <Paths
        s={s}
        paths={[
          [654, 732, 992, 64],
          [654, 1100, 381, 64],
          [1265, 1100, 381, 64],
          [630, 300, 64, 864],
          [1606, 300, 64, 864],
          [1118, 1246, 64, 214],
          [520, 380, 142, 64],
          [520, 980, 142, 64],
          [1638, 380, 142, 64],
          [1638, 980, 142, 64],
          [1118, 660, 64, 104],
        ]}
      />
      <Round s={s} x={1150} y={1132} d={300} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 460, 540, 'right'],
          [60, 660, 460, 540, 'right'],
          [770, 60, 760, 600, 'bottom'],
          [1780, 60, 460, 540, 'left'],
          [1780, 660, 460, 540, 'left'],
        ]}
      />
      <Blocks
        s={s}
        at={[
          [76, 240, 360, 112],
          [76, 472, 360, 112],
          [76, 840, 360, 112],
          [76, 1072, 360, 112],
          [1930, 352, 240, 112],
          [1930, 1014, 232, 168],
        ]}
      />
      <Blocks s={s} at={[[1820, 100, 380, 132]]} fill={WOOD} />
      <Stage s={s} at={[970, 108, 360, 140]} />
      <Seats s={s} xs={[838, 916, 994, 1230, 1308, 1386]} ys={[340, 544]} />
      <Bar x={s.X(1960)} y={s.Y(700)} w={s.L(240)} />
      <Stools xs={[1980, 2040, 2100, 2160].map(s.X)} y={s.Y(850)} />
      <Fountain s={s} x={1150} y={1132} />
      <Tree x={s.X(820)} y={s.Y(900)} r={2.6} />
      <Tree x={s.X(1480)} y={s.Y(900)} r={2.6} />
      <Tree x={s.X(150)} y={s.Y(1320)} r={2.6} />
      <Blocks s={s} at={[[1050, 810, 200, 152]]} fill={WOOD} />
      <Water s={s} at={[260, 1260, 200, 100]} />
      <Arrival x={s.X(1150)} y={s.Y(1390)} />
    </svg>
  );
}

// --- Hotel and Suites: the lobby floor, its bar, ballroom, business centre and library lounge round the open lobby.
function hotelAndSuites(): ReactElement {
  const s = site(2200, 1300);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={MARBLE} door={1100} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 560, 560, 'bottom'],
          [700, 60, 760, 600, 'bottom'],
          [1540, 60, 600, 360, 'bottom'],
          [1540, 640, 600, 360, 'left'],
        ]}
      />
      <Bar x={s.X(100)} y={s.Y(100)} w={s.L(240)} />
      <Stools xs={[120, 180, 240, 300].map(s.X)} y={s.Y(250)} />
      <Stage s={s} at={[900, 108, 360, 140]} />
      <Seats s={s} xs={[768, 846, 924, 1160, 1238, 1316]} ys={[340, 544]} />
      <Blocks s={s} at={[[1580, 140, 232, 168]]} />
      <Blocks s={s} at={[[1650, 680, 380, 132]]} fill={WOOD} />
      <ellipse cx={s.X(400)} cy={s.Y(920)} rx={s.L(100)} ry={s.L(60)} fill={RUG} />
      <ellipse cx={s.X(400)} cy={s.Y(1140)} rx={s.L(100)} ry={s.L(60)} fill={RUG} />
      <Blocks s={s} at={[[980, 880, 240, 112]]} fill={WOOD} />
      <Blocks s={s} at={[[80, 1000, 112, 140]]} fill={STEEL} />
      <Plant x={s.X(930)} y={s.Y(930)} />
      <Plant x={s.X(1260)} y={s.Y(930)} />
      {/* Two pairs of columns either side of the way in. */}
      <Blocks
        s={s}
        at={[700, 860, 1276, 1436].map((x) => [x, 1110, 64, 64] as const)}
        fill="rgb(214 207 196)"
      />
      <Arrival x={s.X(1100)} y={s.Y(1230)} />
    </svg>
  );
}

// --- Co-working Tower: the ground floor, hot desks, a meeting room and the cafe, the two lifts at the left.
function coworkingTower(): ReactElement {
  const s = site(2200, 1260);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={WOOD_FLOOR} door={1100} />
      <Rooms
        s={s}
        rooms={[
          [300, 60, 1100, 540, 'bottom'],
          [1460, 60, 680, 360, 'bottom'],
          [1460, 600, 680, 460, 'bottom'],
        ]}
      />
      <Blocks
        s={s}
        at={[
          [340, 140, 256, 224],
          [716, 140, 256, 224],
          [1092, 140, 256, 224],
          [1868, 130, 232, 168],
        ]}
      />
      <Bar x={s.X(1500)} y={s.Y(640)} w={s.L(240)} />
      <Stools xs={[1520, 1580, 1640, 1700].map(s.X)} y={s.Y(790)} />
      <Blocks
        s={s}
        at={[
          [60, 300, 112, 140],
          [60, 700, 112, 140],
        ]}
        fill={STEEL}
      />
      <ellipse cx={s.X(600)} cy={s.Y(880)} rx={s.L(100)} ry={s.L(60)} fill={RUG} />
      <Plant x={s.X(330)} y={s.Y(1160)} />
      <Plant x={s.X(1410)} y={s.Y(1160)} />
      <Arrival x={s.X(1100)} y={s.Y(1190)} />
    </svg>
  );
}

// --- Expo Hall: the food court, lounge and meeting room along the top, booths either side of the keynote stage.
function expoHall(): ReactElement {
  const s = site(2200, 1460);
  const booths = [800, 1064].flatMap((y) =>
    [60, 240, 420, 1604, 1784, 1964].map((x) => [x, y, 176, 144] as const),
  );
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={CONCRETE} door={1100} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 700, 540, 'bottom'],
          [820, 60, 400, 360, 'bottom'],
          [1300, 60, 460, 400, 'bottom'],
        ]}
      />
      <Bar x={s.X(100)} y={s.Y(100)} w={s.L(240)} />
      <Bar x={s.X(460)} y={s.Y(100)} w={s.L(240)} />
      <Blocks
        s={s}
        at={[
          [100, 414, 232, 168],
          [460, 414, 232, 168],
          [1470, 150, 232, 168],
        ]}
      />
      <ellipse cx={s.X(1100)} cy={s.Y(260)} rx={s.L(100)} ry={s.L(60)} fill={RUG} />
      <Stage s={s} at={[860, 800, 480, 150]} />
      <Curtains s={s} at={[860, 764, 480]} />
      <Podium s={s} x={1180} y={830} />
      <Blocks
        s={s}
        at={[800, 1064].flatMap((y) => [668, 1484].map((x) => [x, y + 100, 48, 48] as const))}
        fill="rgb(203 213 225)"
      />
      <Seats s={s} xs={[788, 866, 944, 1180, 1258, 1336]} ys={[1000, 1204]} />
      <Blocks s={s} at={booths} fill={POD} />
      <Arrival x={s.X(1100)} y={s.Y(1390)} />
    </svg>
  );
}

// --- Beach Offsite: the lagoon, the tiki bar and the beach hut along the top, the beach below the path.
function beachOffsite(): ReactElement {
  const s = site(2000, 1200);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <rect x={s.X(0)} y={s.Y(0)} width={s.L(2000)} height={s.L(1200)} rx="1.5" fill={SAND} />
      <Paths
        s={s}
        paths={[
          [160, 560, 421, 64],
          [619, 560, 1281, 64],
          [568, 611, 64, 589],
          [988, 480, 64, 112],
          [1608, 480, 64, 112],
        ]}
      />
      <Round s={s} x={600} y={592} d={120} />
      <Water s={s} at={[60, 70, 560, 300]} />
      <Rooms
        s={s}
        rooms={[
          [760, 60, 520, 420, 'bottom'],
          [1360, 60, 560, 420, 'bottom'],
        ]}
      />
      <Bar x={s.X(800)} y={s.Y(100)} w={s.L(240)} />
      <Stools xs={[820, 880, 940, 1000].map(s.X)} y={s.Y(250)} />
      <Blocks s={s} at={[[1524, 170, 232, 168]]} />
      <Blocks
        s={s}
        at={[
          [800, 830, 136, 64],
          [1120, 830, 136, 64],
          [960, 980, 136, 64],
          [200, 760, 152, 80],
          [120, 1010, 152, 80],
        ]}
        fill={WOOD}
      />
      <circle cx={s.X(1028)} cy={s.Y(872)} r="1.4" fill={FIRE} />
      <Tree x={s.X(120)} y={s.Y(770)} r={2.6} />
      <Tree x={s.X(440)} y={s.Y(770)} r={2.6} />
      <Tree x={s.X(360)} y={s.Y(1040)} r={2.6} />
      <Tree x={s.X(690)} y={s.Y(200)} r={2.2} />
      <circle cx={s.X(1480)} cy={s.Y(760)} r="2" fill={UMBRELLA} />
      <circle cx={s.X(1720)} cy={s.Y(760)} r="2" fill={UMBRELLA} />
      <SwimmingPool s={s} at={[1400, 900, 440, 200]} />
      <Arrival x={s.X(600)} y={s.Y(1130)} />
    </svg>
  );
}

export function templatePreviewGroup26(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'school-quad':
      return schoolQuad();
    case 'hotel-and-suites':
      return hotelAndSuites();
    case 'coworking-tower':
      return coworkingTower();
    case 'expo-hall':
      return expoHall();
    case 'beach-offsite':
      return beachOffsite();
    default:
      return null;
  }
}
