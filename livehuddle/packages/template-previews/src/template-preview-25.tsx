import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { FURNITURE, Plant, Room, WALL } from './template-preview-23';
import {
  Arrival,
  Bar,
  GRASS,
  PATH,
  PICKET,
  POD,
  RUG,
  DECK,
  POOL,
  STAGE_FRONT,
  STAGE_TOP,
  Stools,
  TARMAC,
  Tree,
  VELVET,
  WOOD,
} from './template-preview-24';

// Group 25: the Campus Spaces (docs/specs/012-collaboration/virtual-office-template.md "Campus Spaces"): the Company
// Campus, the Conference Venue and the Startup HQ, whole sites drawn as the other Spaces' groups draw their floor plans:
// a fenced lawn, the rooms with their doorways, the paths joining them, a stage, rows of seats and the garden. Each
// site is laid out in its template's own canvas px and scaled onto the 80 x 50 tile (`site`), so the tile keeps the
// template's proportions. Each branch returns its <svg> itself (the preview checks read the element's type). Each
// hover story: a character walks in through the gate.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Rect = readonly [x: number, y: number, w: number, h: number];

// A site `width` x `height` canvas px, scaled to fit 74 x 44 and centred on the tile.
export function site(width: number, height: number) {
  const k = Math.min(74 / width, 44 / height);
  const ox = (80 - width * k) / 2;
  const oy = (50 - height * k) / 2;
  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    X: (v: number) => r(ox + v * k),
    Y: (v: number) => r(oy + v * k),
    L: (v: number) => r(v * k),
    width,
    height,
  };
}
export type Site = ReturnType<typeof site>;

// The lawn and its fence, open at the gate in the bottom run.
export function Lawn({ s, gate }: { s: Site; gate: number }) {
  const [l, t, r, b] = [s.X(0), s.Y(0), s.X(s.width), s.Y(s.height)];
  return (
    <>
      <rect x={l} y={t} width={r - l} height={b - t} rx="1.5" fill={GRASS} />
      <path
        d={`M${s.X(gate - 72)} ${b}H${l}V${t}H${r}V${b}H${s.X(gate + 72)}`}
        fill="none"
        stroke={PICKET}
        strokeWidth="0.8"
        strokeDasharray="1.2 0.8"
      />
    </>
  );
}

export const Paths = ({ s, paths }: { s: Site; paths: readonly Rect[] }) => (
  <>
    {paths.map(([x, y, w, h]) => (
      <rect key={`${x}-${y}`} x={s.X(x)} y={s.Y(y)} width={s.L(w)} height={s.L(h)} fill={PATH} />
    ))}
  </>
);

export const Rooms = ({ s, rooms }: { s: Site; rooms: readonly (readonly [...Rect, Side])[] }) => (
  <>
    {rooms.map(([x, y, w, h, door]) => (
      <Room key={`${x}-${y}`} x={s.X(x)} y={s.Y(y)} w={s.L(w)} h={s.L(h)} door={door} />
    ))}
  </>
);

// A stage: its top over its front edge.
export const Stage = ({ s, at: [x, y, w, h] }: { s: Site; at: Rect }) => (
  <>
    <rect x={s.X(x)} y={s.Y(y)} width={s.L(w)} height={s.L(h)} rx="0.8" fill={STAGE_TOP} />
    <rect x={s.X(x)} y={s.Y(y + h) - 1.4} width={s.L(w)} height="1.4" rx="0.4" fill={STAGE_FRONT} />
  </>
);

// Stage Curtains over a stage (docs/specs/009-elements/venue-pieces.md): a pelmet along its back and a drape either
// side, open in the middle.
export const Curtains = ({
  s,
  at: [x, y, w],
}: {
  s: Site;
  at: readonly [number, number, number];
}) => (
  <>
    <rect x={s.X(x)} y={s.Y(y)} width={s.L(w)} height="0.9" rx="0.3" fill={VELVET} />
    <rect x={s.X(x)} y={s.Y(y)} width="1.1" height={s.L(w / 3)} rx="0.4" fill={VELVET} />
    <rect x={s.X(x + w) - 1.1} y={s.Y(y)} width="1.1" height={s.L(w / 3)} rx="0.4" fill={VELVET} />
  </>
);

// A podium on a stage: a small wooden block.
export const Podium = ({ s, x, y }: { s: Site; x: number; y: number }) => (
  <rect x={s.X(x)} y={s.Y(y)} width="1.4" height="1.9" rx="0.3" fill={WOOD} />
);

// A swimming pool: its deck round the water.
export const SwimmingPool = ({ s, at: [x, y, w, h] }: { s: Site; at: Rect }) => (
  <>
    <rect x={s.X(x)} y={s.Y(y)} width={s.L(w)} height={s.L(h)} rx="0.4" fill={DECK} />
    <rect
      x={s.X(x) + 0.5}
      y={s.Y(y) + 0.5}
      width={s.L(w) - 1}
      height={s.L(h) - 1}
      rx="0.3"
      fill={POOL}
    />
  </>
);

// A car park: tarmac with a red car and a blue one in its outer bays.
export const CarPark = ({ s, at: [x, y, w, h] }: { s: Site; at: Rect }) => (
  <>
    <rect x={s.X(x)} y={s.Y(y)} width={s.L(w)} height={s.L(h)} rx="0.3" fill={TARMAC} />
    {[0.12, 0.88].map((t, i) => (
      <rect
        key={t}
        x={s.X(x + w * t) - 0.7}
        y={s.Y(y + h / 2) - 0.6}
        width="1.4"
        height="1.6"
        rx="0.4"
        fill={i ? 'rgb(37 99 235)' : 'rgb(220 38 38)'}
      />
    ))}
  </>
);

// Rows of seats facing a stage, one small square a seat.
export const Seats = ({ s, xs, ys }: { s: Site; xs: readonly number[]; ys: readonly number[] }) => (
  <>
    {ys.flatMap((y) =>
      xs.map((x) => (
        <rect
          key={`${x}-${y}`}
          x={s.X(x)}
          y={s.Y(y)}
          width="1.8"
          height="1.8"
          rx="0.4"
          fill={WALL}
        />
      )),
    )}
  </>
);

// Plain pieces (desks, tables, sofas) as rounded blocks.
export const Blocks = ({
  s,
  at,
  fill = FURNITURE,
}: {
  s: Site;
  at: readonly Rect[];
  fill?: string;
}) => (
  <>
    {at.map(([x, y, w, h]) => (
      <rect
        key={`${x}-${y}`}
        x={s.X(x)}
        y={s.Y(y)}
        width={s.L(w)}
        height={s.L(h)}
        rx="0.5"
        fill={fill}
      />
    ))}
  </>
);

export const Water = ({ s, at: [x, y, w, h] }: { s: Site; at: Rect }) => (
  <ellipse
    cx={s.X(x + w / 2)}
    cy={s.Y(y + h / 2)}
    rx={s.L(w / 2)}
    ry={s.L(h / 2)}
    fill="rgb(125 211 252)"
    stroke={WALL}
    strokeWidth="0.3"
  />
);

// --- Company Campus: offices down the left, the auditorium across the top, the bar and games room on the right.
function companyCampus(): ReactElement {
  const s = site(2320, 1360);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Lawn s={s} gate={1160} />
      <Paths
        s={s}
        paths={[
          [560, 330, 64, 930],
          [1696, 310, 64, 750],
          [560, 860, 1200, 64],
          [1028, 800, 264, 184],
          [1128, 660, 64, 700],
        ]}
      />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 500, 640, 'right'],
          [60, 760, 500, 280, 'right'],
          [60, 1100, 500, 220, 'right'],
          [680, 60, 960, 600, 'bottom'],
          [1760, 60, 500, 620, 'left'],
          [1760, 740, 500, 540, 'left'],
        ]}
      />
      <Blocks
        s={s}
        at={[
          [100, 116, 256, 224],
          [100, 460, 256, 224],
          [180, 834, 232, 168],
          [260, 1160, 120, 112],
        ]}
      />
      <Stage s={s} at={[940, 108, 440, 150]} />
      <Seats s={s} xs={[770, 848, 926, 1004, 1240, 1318, 1396, 1474]} ys={[350, 554]} />
      <Bar x={s.X(1900)} y={s.Y(100)} w={s.L(240)} />
      <Stools xs={[1925, 1985, 2045, 2105].map(s.X)} y={s.Y(250)} />
      <Blocks s={s} at={[[1984, 500, 152, 85]]} />
      <Blocks s={s} at={[[1950, 800, 184, 112]]} fill="rgb(52 211 153)" />
      <circle
        cx={s.X(1160)}
        cy={s.Y(892)}
        r="1.8"
        fill="rgb(186 230 253)"
        stroke={WALL}
        strokeWidth="0.3"
      />
      <Tree x={s.X(748)} y={s.Y(740)} r={2.6} />
      <Tree x={s.X(1608)} y={s.Y(740)} r={2.6} />
      <Tree x={s.X(700)} y={s.Y(1250)} r={2.6} />
      <Tree x={s.X(1560)} y={s.Y(1080)} r={3} />
      {/* By the gate: the car park to its right, a bike rack to its left. */}
      <CarPark s={s} at={[1300, 1200, 480, 128]} />
      <Blocks s={s} at={[[960, 1250, 136, 64]]} fill="rgb(148 163 184)" />
      <Tree x={s.X(620)} y={s.Y(100)} r={2.4} />
      <Tree x={s.X(1700)} y={s.Y(100)} r={2.4} />
      <Blocks s={s} at={[[720, 1000, 200, 152]]} fill={WOOD} />
      <Water s={s} at={[820, 1200, 200, 100]} />
      <Plant x={s.X(1246)} y={s.Y(1240)} />
      <Arrival x={s.X(1160)} y={s.Y(1290)} />
    </svg>
  );
}

// --- Conference Venue: the main hall between the foyer bar and the green room, breakouts below, the courtyard between.
function conferenceVenue(): ReactElement {
  const s = site(2120, 1460);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Lawn s={s} gate={1060} />
      <Paths
        s={s}
        paths={[
          [208, 860, 1704, 64],
          [208, 680, 64, 180],
          [1848, 400, 64, 460],
          [228, 924, 64, 176],
          [698, 924, 64, 176],
          [1358, 924, 64, 176],
          [1828, 924, 64, 176],
          [1028, 680, 64, 780],
        ]}
      />
      <Rooms
        s={s}
        rooms={[
          [40, 40, 400, 640, 'bottom'],
          [500, 40, 1120, 640, 'bottom'],
          [1680, 40, 400, 360, 'bottom'],
          [40, 1100, 440, 320, 'top'],
          [520, 1100, 420, 320, 'top'],
          [1180, 1100, 420, 320, 'top'],
          [1640, 1100, 440, 320, 'top'],
        ]}
      />
      <Bar x={s.X(80)} y={s.Y(80)} w={s.L(240)} />
      <Stools xs={[100, 160, 220, 280].map(s.X)} y={s.Y(240)} />
      <ellipse cx={s.X(290)} cy={s.Y(480)} rx={s.L(100)} ry={s.L(60)} fill={RUG} />
      <Stage s={s} at={[820, 88, 480, 150]} />
      <Curtains s={s} at={[820, 60, 480]} />
      <Podium s={s} x={1180} y={130} />
      <Seats s={s} xs={[592, 670, 748, 826, 904, 1140, 1218, 1296, 1374, 1452]} ys={[330, 534]} />
      <ellipse cx={s.X(1960)} cy={s.Y(250)} rx={s.L(100)} ry={s.L(60)} fill={RUG} />
      <Blocks
        s={s}
        at={[
          [144, 1240, 232, 168],
          [614, 1240, 232, 168],
          [1274, 1240, 232, 168],
        ]}
      />
      <Blocks
        s={s}
        at={[
          [1680, 1250, 176, 144],
          [1864, 1250, 176, 144],
        ]}
        fill={POD}
      />
      <Water s={s} at={[386, 950, 196, 110]} />
      <Water s={s} at={[1540, 950, 200, 110]} />
      <circle
        cx={s.X(1228)}
        cy={s.Y(1010)}
        r="1.6"
        fill="rgb(186 230 253)"
        stroke={WALL}
        strokeWidth="0.3"
      />
      <Tree x={s.X(1176)} y={s.Y(760)} r={2.4} />
      <Tree x={s.X(1756)} y={s.Y(760)} r={2.4} />
      <Tree x={s.X(1760)} y={s.Y(510)} r={2.4} />
      <circle cx={s.X(530)} cy={s.Y(760)} r="2" fill="rgb(248 113 113)" />
      <circle cx={s.X(760)} cy={s.Y(760)} r="2" fill="rgb(248 113 113)" />
      <Arrival x={s.X(1060)} y={s.Y(1390)} />
    </svg>
  );
}

// --- Startup HQ: the studio, the town hall and the kitchen bar along the top, the games room and the garden below.
function startupHq(): ReactElement {
  const s = site(2100, 1240);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Lawn s={s} gate={1200} />
      <Paths
        s={s}
        paths={[
          [368, 680, 1524, 64],
          [368, 540, 64, 140],
          [1828, 620, 64, 60],
          [1598, 744, 64, 56],
          [1168, 660, 64, 580],
        ]}
      />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 680, 480, 'bottom'],
          [820, 60, 760, 600, 'bottom'],
          [1660, 60, 400, 560, 'bottom'],
          [1380, 800, 500, 380, 'top'],
        ]}
      />
      <Blocks
        s={s}
        at={[
          [90, 120, 256, 224],
          [466, 120, 256, 224],
        ]}
      />
      <Stage s={s} at={[1020, 108, 360, 140]} />
      <Seats s={s} xs={[888, 966, 1044, 1280, 1358, 1436]} ys={[340, 544]} />
      <Bar x={s.X(1700)} y={s.Y(100)} w={s.L(240)} />
      <Stools xs={[1720, 1780, 1840, 1900].map(s.X)} y={s.Y(250)} />
      <Blocks s={s} at={[[1440, 960, 184, 112]]} fill="rgb(52 211 153)" />
      <Water s={s} at={[80, 860, 260, 150]} />
      <circle cx={s.X(720)} cy={s.Y(956)} r="1.4" fill="rgb(249 115 22)" />
      <Blocks
        s={s}
        at={[
          [920, 770, 176, 144],
          [160, 1050, 176, 144],
        ]}
        fill={POD}
      />
      <Tree x={s.X(100)} y={s.Y(1110)} r={2.6} />
      <Tree x={s.X(460)} y={s.Y(840)} r={2.6} />
      <Tree x={s.X(1980)} y={s.Y(900)} r={2.2} />
      <Blocks s={s} at={[[480, 1124, 152, 80]]} fill={WOOD} />
      <Arrival x={s.X(1200)} y={s.Y(1170)} />
    </svg>
  );
}

export function templatePreviewGroup25(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'company-campus':
      return companyCampus();
    case 'conference-venue':
      return conferenceVenue();
    case 'startup-hq':
      return startupHq();
    default:
      return null;
  }
}
