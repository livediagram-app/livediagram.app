import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { Plant, WALL } from './template-preview-23';
import { Arrival, Bar, GRASS, PICKET, POOL, RUG, Stools, Tree, WOOD } from './template-preview-24';
import {
  Blocks,
  Curtains,
  Rooms,
  Seats,
  site,
  Stage,
  Water,
  type Rect,
  type Site,
} from './template-preview-25';

// Group 27: the Games Rooms, the Homes and the Music Hall (docs/specs/012-collaboration/virtual-office-template.md
// "Games Rooms", "Homes", "Venues", Work Tracker #641). Drawn as groups 25 and 26 draw their sites, in the template's
// own canvas px scaled onto the 80 x 50 tile: a building's floor in its colour inside an outline, its rooms, and the
// pieces each place is about (the arcade machines, the games tables, the fire, the Stairs). A house shows its
// Downstairs. Each hover story: a character walks in at the front door.

const CARPET = 'rgb(224 214 238)';
const WOOD_FLOOR = 'rgb(234 218 192)';
const PARQUET = 'rgb(226 204 170)';
const CABINET = 'rgb(124 58 237)';
const SCREEN_GLOW = 'rgb(103 232 249)';
const CLOTH = 'rgb(22 163 74)';
const FIRE = 'rgb(249 115 22)';
const GLASS = 'rgb(125 211 252)';
const STEP = 'rgb(168 162 158)';
const TILE = 'rgb(186 230 253)';

// A building's floor: its colour, inside an outline open at the front door in the bottom wall.
function Floor({ s, fill, door }: { s: Site; fill: string; door: number }) {
  const [l, t, r, b] = [s.X(0), s.Y(0), s.X(s.width), s.Y(s.height)];
  return (
    <>
      <rect x={l} y={t} width={r - l} height={b - t} rx="1" fill={fill} />
      <path
        d={`M${s.X(door - 72)} ${b}H${l}V${t}H${r}V${b}H${s.X(door + 72)}`}
        fill="none"
        stroke={WALL}
        strokeWidth="0.5"
      />
    </>
  );
}

// A glass room: a pale blue pane over its walls.
const Glass = ({ s, at: [x, y, w, h] }: { s: Site; at: Rect }) => (
  <rect
    x={s.X(x)}
    y={s.Y(y)}
    width={s.L(w)}
    height={s.L(h)}
    rx="0.6"
    fill="none"
    stroke={GLASS}
    strokeWidth="0.7"
  />
);

// Arcade machines seen from above: a purple cabinet with a glowing screen.
const Cabinets = ({ s, xs, ys }: { s: Site; xs: readonly number[]; ys: readonly number[] }) => (
  <>
    {ys.flatMap((y) =>
      xs.map((x) => (
        <g key={`${x}-${y}`}>
          <rect x={s.X(x)} y={s.Y(y)} width={s.L(64)} height={s.L(112)} rx="0.3" fill={CABINET} />
          <rect
            x={s.X(x + 12)}
            y={s.Y(y + 18)}
            width={s.L(40)}
            height={s.L(32)}
            fill={SCREEN_GLOW}
          />
        </g>
      )),
    )}
  </>
);

// A games table: a green cloth inside a wooden rim (a pool table, a ping-pong table, a foosball table).
const GamesTable = ({ s, at: [x, y, w, h] }: { s: Site; at: Rect }) => (
  <>
    <rect x={s.X(x)} y={s.Y(y)} width={s.L(w)} height={s.L(h)} rx="0.4" fill={WOOD} />
    <rect x={s.X(x + 14)} y={s.Y(y + 14)} width={s.L(w - 28)} height={s.L(h - 28)} fill={CLOTH} />
  </>
);

// A fire on a back wall: its hearth and the flame.
const Fire = ({ s, x, y }: { s: Site; x: number; y: number }) => (
  <>
    <rect x={s.X(x)} y={s.Y(y)} width={s.L(128)} height={s.L(120)} rx="0.4" fill={WALL} />
    <circle cx={s.X(x + 64)} cy={s.Y(y + 72)} r={s.L(30)} fill={FIRE} />
  </>
);

// A flight of Stairs: its treads as stripes.
const Stairs = ({ s, x, y }: { s: Site; x: number; y: number }) => (
  <>
    <rect x={s.X(x)} y={s.Y(y)} width={s.L(96)} height={s.L(128)} rx="0.3" fill={STEP} />
    {[24, 56, 88].map((dy) => (
      <rect key={dy} x={s.X(x)} y={s.Y(y + dy)} width={s.L(96)} height="0.4" fill={WALL} />
    ))}
  </>
);

// Windows in a wall, each a short pale bar along it: [x, y, along the wall horizontally].
const Windows = ({ s, at }: { s: Site; at: readonly (readonly [number, number, boolean])[] }) => (
  <>
    {at.map(([x, y, across]) => (
      <rect
        key={`${x}-${y}`}
        x={s.X(across ? x - 60 : x - 6)}
        y={s.Y(across ? y - 6 : y - 60)}
        width={s.L(across ? 120 : 12)}
        height={s.L(across ? 12 : 120)}
        fill={TILE}
      />
    ))}
  </>
);

const Rug = ({ s, at: [x, y, w, h] }: { s: Site; at: Rect }) => (
  <ellipse cx={s.X(x + w / 2)} cy={s.Y(y + h / 2)} rx={s.L(w / 2)} ry={s.L(h / 2)} fill={RUG} />
);

// --- Arcade Lounge: two banks of machines on the arcade floor, the snack bar, party room and lounge across the top.
function arcadeLounge(): ReactElement {
  const s = site(2000, 1240);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={CARPET} door={1000} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 660, 500, 'bottom'],
          [780, 60, 520, 500, 'bottom'],
          [1380, 60, 560, 500, 'bottom'],
        ]}
      />
      <Glass s={s} at={[780, 60, 520, 500]} />
      <Bar x={s.X(100)} y={s.Y(100)} w={s.L(240)} />
      <Stools xs={[120, 180, 240, 300].map(s.X)} y={s.Y(250)} />
      <Blocks
        s={s}
        at={[
          [470, 360, 232, 168],
          [924, 210, 232, 168],
        ]}
      />
      <Rug s={s} at={[1440, 280, 160, 160]} />
      <Rug s={s} at={[1720, 280, 200, 120]} />
      <Cabinets
        s={s}
        xs={[160, 240, 320, 400, 480, 1420, 1500, 1580, 1660, 1740]}
        ys={[760, 980]}
      />
      <Blocks s={s} at={[[640, 1060, 200, 112]]} fill={WOOD} />
      <Plant x={s.X(320)} y={s.Y(1150)} />
      <Plant x={s.X(1660)} y={s.Y(1150)} />
      <Arrival x={s.X(1000)} y={s.Y(1170)} />
    </svg>
  );
}

// --- Games Night Den: the den round the fire, the games room of pool and foosball, the kitchen below it.
function gamesNightDen(): ReactElement {
  const s = site(1800, 1200);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={WOOD_FLOOR} door={590} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 1060, 560, 'bottom'],
          [1180, 60, 560, 560, 'bottom'],
          [1180, 800, 560, 340, 'top'],
        ]}
      />
      <Windows
        s={s}
        at={[
          [420, 91, true],
          [760, 91, true],
        ]}
      />
      <Fire s={s} x={526} y={100} />
      <Blocks
        s={s}
        at={[
          [100, 100, 120, 132],
          [228, 100, 120, 132],
          [920, 100, 120, 132],
        ]}
        fill={WOOD}
      />
      <Rug s={s} at={[470, 260, 240, 160]} />
      <Blocks
        s={s}
        at={[
          [514, 290, 152, 85],
          [120, 390, 232, 168],
          [840, 390, 232, 168],
        ]}
      />
      <GamesTable s={s} at={[1360, 180, 200, 128]} />
      <GamesTable s={s} at={[1376, 390, 168, 104]} />
      <Blocks
        s={s}
        at={[
          [1300, 1030, 224, 88],
          [1540, 990, 72, 136],
        ]}
      />
      <Blocks s={s} at={[[120, 900, 160, 112]]} fill={RUG} />
      <Plant x={s.X(330)} y={s.Y(1110)} />
      <Arrival x={s.X(590)} y={s.Y(1130)} />
    </svg>
  );
}

// --- Sports Bar: the bar and the glass screen lounge across the top, ping-pong, pool and foosball on the games floor.
function sportsBar(): ReactElement {
  const s = site(2100, 1260);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={WOOD_FLOOR} door={1050} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 960, 620, 'bottom'],
          [1080, 60, 960, 560, 'bottom'],
        ]}
      />
      <Glass s={s} at={[1080, 60, 960, 560]} />
      <Bar x={s.X(210)} y={s.Y(100)} w={s.L(480)} />
      <Stools xs={[230, 290, 350, 410, 470, 530, 590, 650].map(s.X)} y={s.Y(250)} />
      <Blocks
        s={s}
        at={[
          [120, 420, 232, 168],
          [480, 420, 232, 168],
        ]}
      />
      <Blocks
        s={s}
        at={[
          [1200, 100, 192, 120],
          [1728, 100, 192, 120],
        ]}
        fill="rgb(30 41 59)"
      />
      {[1160, 1460, 1760].map((x) => (
        <Rug key={x} s={s} at={[x, 280, 200, 120]} />
      ))}
      {[1160, 1760].map((x) => (
        <Rug key={x} s={s} at={[x, 485, 200, 120]} />
      ))}
      <GamesTable s={s} at={[160, 860, 184, 112]} />
      <GamesTable s={s} at={[504, 860, 184, 112]} />
      <GamesTable s={s} at={[1240, 840, 200, 128]} />
      <GamesTable s={s} at={[1640, 852, 168, 104]} />
      <Plant x={s.X(430)} y={s.Y(1170)} />
      <Plant x={s.X(1630)} y={s.Y(1170)} />
      <Arrival x={s.X(1050)} y={s.Y(1190)} />
    </svg>
  );
}

// --- Family House: the living room by the fire and the kitchen either side of the hall, the Stairs at its top.
function familyHouse(): ReactElement {
  const s = site(1900, 1200);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={WOOD_FLOOR} door={950} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 760, 640, 'right'],
          [1080, 60, 760, 640, 'left'],
          [60, 800, 400, 340, 'right'],
          [1300, 800, 540, 340, 'left'],
        ]}
      />
      <Windows
        s={s}
        at={[
          [298, 91, true],
          [65, 320, false],
          [65, 540, false],
          [1835, 320, false],
          [1835, 540, false],
        ]}
      />
      <Fire s={s} x={376} y={100} />
      <Rug s={s} at={[320, 290, 240, 160]} />
      <Blocks s={s} at={[[364, 310, 152, 85]]} />
      <Blocks s={s} at={[[100, 100, 120, 132]]} fill={WOOD} />
      <Blocks s={s} at={[[1104, 96, 420, 136]]} />
      <Blocks s={s} at={[[1200, 390, 560, 168]]} fill={WOOD} />
      <Rug s={s} at={[1460, 920, 160, 160]} />
      <Stairs s={s} x={902} y={140} />
      <Plant x={s.X(1210)} y={s.Y(1120)} />
      <Arrival x={s.X(950)} y={s.Y(1130)} />
    </svg>
  );
}

// --- City Townhouse: the kitchen-diner across the back, the front room and the Stairs in the hall.
function cityTownhouse(): ReactElement {
  const s = site(1400, 1200);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={PARQUET} door={1060} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 1280, 520, 'bottom'],
          [60, 760, 700, 400, 'right'],
        ]}
      />
      <Windows
        s={s}
        at={[
          [820, 91, true],
          [1060, 91, true],
          [65, 360, false],
        ]}
      />
      <Blocks s={s} at={[[84, 96, 494, 136]]} />
      <Blocks s={s} at={[[140, 300, 560, 168]]} fill={WOOD} />
      <Rug s={s} at={[820, 360, 200, 120]} />
      <Rug s={s} at={[300, 960, 200, 120]} />
      <Blocks s={s} at={[[310, 804, 192, 120]]} fill="rgb(30 41 59)" />
      <Stairs s={s} x={1180} y={780} />
      <Plant x={s.X(1290)} y={s.Y(1120)} />
      <Arrival x={s.X(1060)} y={s.Y(1130)} />
    </svg>
  );
}

// --- Country Cottage: the farmhouse kitchen and the snug, the Stairs in the hall, the cottage garden beside them.
function countryCottage(): ReactElement {
  const s = site(1900, 1200);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={WOOD_FLOOR} door={700} />
      <rect x={s.X(1420)} y={s.Y(60)} width={s.L(420)} height={s.L(1080)} rx="0.8" fill={GRASS} />
      <path
        d={`M${s.X(1420)} ${s.Y(488)}V${s.Y(60)}H${s.X(1840)}V${s.Y(1140)}H${s.X(1420)}V${s.Y(700)}`}
        fill="none"
        stroke={PICKET}
        strokeWidth="0.6"
        strokeDasharray="1.2 0.8"
      />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 720, 580, 'bottom'],
          [840, 60, 520, 580, 'bottom'],
        ]}
      />
      <Windows
        s={s}
        at={[
          [65, 260, false],
          [65, 500, false],
          [1100, 91, true],
        ]}
      />
      <Fire s={s} x={356} y={100} />
      <Blocks s={s} at={[[260, 360, 232, 168]]} fill={WOOD} />
      <Rug s={s} at={[990, 340, 200, 120]} />
      <Stairs s={s} x={300} y={780} />
      <Water s={s} at={[1480, 340, 240, 152]} />
      <Tree x={s.X(1720)} y={s.Y(200)} r={2.4} />
      <Tree x={s.X(1720)} y={s.Y(1000)} r={2.4} />
      <Arrival x={s.X(700)} y={s.Y(1130)} />
    </svg>
  );
}

// --- Music Hall: the main hall's curtained stage and its rows, the foyer bar, the green room and the cloakroom.
function musicHall(): ReactElement {
  const s = site(2200, 1460);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={PARQUET} door={1100} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 1120, 800, 'bottom'],
          [1260, 60, 880, 560, 'bottom'],
          [1700, 700, 440, 400, 'left'],
          [60, 960, 420, 380, 'right'],
        ]}
      />
      <Stage s={s} at={[380, 108, 480, 150]} />
      <Curtains s={s} at={[380, 72, 480]} />
      <Seats s={s} xs={[152, 230, 308, 386, 464, 700, 778, 856, 934, 1012]} ys={[520, 724]} />
      <Bar x={s.X(1620)} y={s.Y(100)} w={s.L(480)} />
      <Stools xs={[1640, 1700, 1760, 1820, 1880, 1940, 2000, 2060].map(s.X)} y={s.Y(250)} />
      <Rug s={s} at={[1880, 880, 200, 120]} />
      <Blocks
        s={s}
        at={[760, 880, 1260, 1380].map((x) => [x, 1060, 64, 168] as const)}
        fill="rgb(214 207 196)"
      />
      <Blocks s={s} at={[[1480, 1180, 200, 112]]} fill={WOOD} />
      <circle cx={s.X(620)} cy={s.Y(380)} r="1.2" fill={POOL} />
      <Arrival x={s.X(1100)} y={s.Y(1390)} />
    </svg>
  );
}

export function templatePreviewGroup27(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'arcade-lounge':
      return arcadeLounge();
    case 'games-night-den':
      return gamesNightDen();
    case 'sports-bar':
      return sportsBar();
    case 'family-house':
      return familyHouse();
    case 'city-townhouse':
      return cityTownhouse();
    case 'country-cottage':
      return countryCottage();
    case 'music-hall':
      return musicHall();
    default:
      return null;
  }
}
