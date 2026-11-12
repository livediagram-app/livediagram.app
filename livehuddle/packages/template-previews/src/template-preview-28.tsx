import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { Plant } from './template-preview-23';
import { Arrival, Bar, Stools, Tree, WOOD } from './template-preview-24';
import { Blocks, Curtains, Lawn, Paths, Rooms, site, Stage } from './template-preview-25';
import { FIRE, Round, UMBRELLA } from './template-preview-26';

// Group 28: the Festival Field (docs/specs/012-collaboration/virtual-office-template.md "Venues", Work Tracker #648), the
// open-air venue, drawn as group 25 draws its sites, in the template's own canvas px scaled onto the 80 x 50 tile: the
// fenced field, the curtained Main Stage across the top with a Screen either side, the three food stalls down the left,
// the Bar Tent and the campfire's benches down the right. Its hover story: a character walks in at the gate.

const SCREEN = 'rgb(51 65 85)';

const STALLS = [60, 400, 740];

function festivalField(): ReactElement {
  const s = site(2560, 1440);
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      <Lawn s={s} gate={1280} />
      <Paths
        s={s}
        paths={[
          [634, 1128, 1292, 64],
          [610, 210, 64, 1030],
          [1886, 310, 64, 930],
          [1248, 1160, 64, 280],
        ]}
      />
      <Round s={s} x={1280} y={1160} d={120} />
      <Rooms
        s={s}
        rooms={[
          ...STALLS.map((y) => [60, y, 440, 280, 'right'] as const),
          [2060, 60, 440, 560, 'left'],
        ]}
      />
      {/* Each stall's counter and stools, then the Bar Tent's, and its sofa. */}
      {STALLS.map((y) => (
        <g key={y}>
          <Bar x={s.X(100)} y={s.Y(y + 40)} w={s.L(240)} />
          <Stools xs={[120, 180, 240, 300].map(s.X)} y={s.Y(y + 190)} />
        </g>
      ))}
      <Bar x={s.X(2200)} y={s.Y(100)} w={s.L(240)} />
      <Stools xs={[2220, 2280, 2340, 2400].map(s.X)} y={s.Y(250)} />
      <Blocks s={s} at={[[2244, 480, 152, 85]]} />
      {/* The open-air Main Stage, its curtains behind it, a Screen either side. */}
      <Stage s={s} at={[960, 110, 640, 170]} />
      <Curtains s={s} at={[960, 40, 640]} />
      <Blocks
        s={s}
        at={[
          [740, 120, 176, 110],
          [1644, 120, 176, 110],
        ]}
        fill={SCREEN}
      />
      {/* Picnic tables by the food lane, an umbrella beside each. */}
      <Blocks
        s={s}
        at={[
          [720, 420, 200, 152],
          [720, 740, 200, 152],
          [760, 1240, 200, 152],
        ]}
        fill={WOOD}
      />
      <circle cx={s.X(996)} cy={s.Y(496)} r="1.8" fill={UMBRELLA} />
      <circle cx={s.X(996)} cy={s.Y(816)} r="1.8" fill={UMBRELLA} />
      {/* The campfire and its four benches. */}
      <Blocks
        s={s}
        at={[
          [1996, 884, 136, 64],
          [2328, 884, 136, 64],
          [2162, 754, 136, 64],
          [2162, 1006, 136, 64],
        ]}
        fill={WOOD}
      />
      <circle cx={s.X(2230)} cy={s.Y(916)} r="1.4" fill={FIRE} />
      <Tree x={s.X(2030)} y={s.Y(740)} r={2.2} />
      <Tree x={s.X(2448)} y={s.Y(754)} r={2.4} />
      <Tree x={s.X(168)} y={s.Y(1314)} r={2.4} />
      <Tree x={s.X(468)} y={s.Y(1314)} r={2.4} />
      <Tree x={s.X(1748)} y={s.Y(1304)} r={2.4} />
      <Tree x={s.X(2148)} y={s.Y(1304)} r={2.4} />
      <Plant x={s.X(1176)} y={s.Y(1340)} />
      <Arrival x={s.X(1280)} y={s.Y(1370)} />
    </svg>
  );
}

export function templatePreviewGroup28(kind: TemplateKind): ReactElement | null {
  return kind === 'festival-field' ? festivalField() : null;
}
