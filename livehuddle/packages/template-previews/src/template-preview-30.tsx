import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { Plant } from './template-preview-23';
import { Arrival, Bar, POD, RUG, Stools, WOOD } from './template-preview-24';
import { Blocks, Podium, Rooms, Seats, site, Water } from './template-preview-25';
import { Floor } from './template-preview-26';

// Group 30: the Art Gallery and the Wellness Studio (docs/specs/012-collaboration/virtual-office-template.md "Art
// Gallery and Wellness Studio"), drawn as group 29 draws its buildings: the floor inside an outline open at the
// entrance, each room with its doorway, and the pieces that make each room what it is, in the template's own canvas px
// scaled onto the 80 x 50 tile. Each hover story: a character walks in at the entrance.

const PARQUET = 'rgb(234 218 192)';
const OAK = 'rgb(222 196 160)';
const FRAME = 'rgb(51 65 85)';
const STONE = 'rgb(226 232 240)';
const MAT = 'rgb(134 239 172)';

// --- Art Gallery: the Main Gallery, the Sculpture Hall and the Talk Room along the top, the foyer below.
function artGallery(): ReactElement {
  const s = site(2200, 1320);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={PARQUET} door={1100} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 860, 640, 'bottom'],
          [980, 60, 700, 640, 'bottom'],
          [1740, 60, 400, 640, 'bottom'],
        ]}
      />
      <Blocks
        s={s}
        at={[
          [120, 64, 176, 112],
          [402, 64, 176, 112],
          [684, 64, 176, 112],
          [1060, 64, 176, 112],
          [1424, 64, 176, 112],
          [1880, 64, 120, 80],
        ]}
        fill={FRAME}
      />
      <Blocks
        s={s}
        at={[
          [300, 390, 136, 64],
          [544, 390, 136, 64],
        ]}
        fill={WOOD}
      />
      <Blocks
        s={s}
        at={[
          [1160, 240, 64, 64],
          [1436, 240, 64, 64],
          [1160, 430, 64, 64],
          [1436, 430, 64, 64],
        ]}
        fill={STONE}
      />
      <Podium s={s} x={1940} y={200} />
      <Seats s={s} xs={[1814, 1902, 1990]} ys={[320, 540]} />
      <Blocks s={s} at={[[220, 860, 200, 112]]} fill={WOOD} />
      <Bar x={s.X(1500)} y={s.Y(860)} w={s.L(240)} />
      <Stools xs={[1520, 1580, 1640, 1700].map(s.X)} y={s.Y(1000)} />
      <ellipse cx={s.X(1700)} cy={s.Y(1170)} rx={s.L(100)} ry={s.L(60)} fill={RUG} />
      <Plant x={s.X(60)} y={s.Y(1260)} />
      <Plant x={s.X(2120)} y={s.Y(1260)} />
      <Arrival x={s.X(1100)} y={s.Y(1250)} />
    </svg>
  );
}

// --- Wellness Studio: the Yoga Studio, the Meditation Room and the Gym along the top, the Nap Room and the lobby below.
function wellnessStudio(): ReactElement {
  const s = site(2100, 1340);
  const mats = [200, 360, 520, 680];
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Floor s={s} fill={OAK} door={1050} />
      <Rooms
        s={s}
        rooms={[
          [60, 60, 900, 640, 'bottom'],
          [1020, 60, 560, 640, 'bottom'],
          [1640, 60, 400, 640, 'bottom'],
          [1460, 880, 580, 400, 'left'],
        ]}
      />
      <Blocks s={s} at={[[450, 64, 120, 80]]} fill={FRAME} />
      <Blocks
        s={s}
        at={[[466, 160, 88, 200], ...mats.map((x) => [x, 420, 88, 200] as const)]}
        fill={MAT}
      />
      <circle cx={s.X(1300)} cy={s.Y(420)} r={s.L(140)} fill={RUG} />
      <Water s={s} at={[1232, 360, 136, 120]} />
      <Blocks
        s={s}
        at={[
          [1720, 100, 72, 112],
          [1804, 100, 72, 112],
          [1888, 100, 72, 112],
        ]}
      />
      <Blocks
        s={s}
        at={[
          [1580, 940, 120, 112],
          [1820, 940, 120, 112],
        ]}
        fill={POD}
      />
      <Blocks s={s} at={[[180, 860, 200, 112]]} fill={WOOD} />
      <Bar x={s.X(760)} y={s.Y(860)} w={s.L(240)} />
      <Stools xs={[780, 840, 900, 960].map(s.X)} y={s.Y(1000)} />
      <Plant x={s.X(60)} y={s.Y(1280)} />
      <Plant x={s.X(1380)} y={s.Y(1280)} />
      <Arrival x={s.X(1050)} y={s.Y(1270)} />
    </svg>
  );
}

export function templatePreviewGroup30(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'art-gallery':
      return artGallery();
    case 'wellness-studio':
      return wellnessStudio();
    default:
      return null;
  }
}
