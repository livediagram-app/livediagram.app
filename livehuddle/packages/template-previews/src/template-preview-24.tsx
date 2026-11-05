import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { FILL_BOX } from '@liveworkspace/template-previews/story-parts';
import { FURNITURE, LEAF, Plant, Room, SHIRT, WALL } from './template-preview-23';

// Group 24: the six Spaces that followed the first four (docs/specs/012-collaboration/virtual-office-template.md
// "Spaces"): the Focus Library, the Training Room, the Rooftop Bar, the Cafe, the Garden Retreat and the City Park,
// drawn as group 23 draws its floor plans. Each hover story: a character walks in through the doorway or the gate.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

export const RUG = 'rgb(253 230 138)';
export const WOOD = 'rgb(194 137 75)';
const COUNTER = 'rgb(87 83 78)';
export const POD = 'rgb(165 180 252)';
export const GRASS = 'rgb(155 210 122)';
export const PATH = 'rgb(231 220 196)';
const TREE = 'rgb(34 197 94)';
export const PICKET = 'rgb(255 255 255)';
export const STAGE_TOP = 'rgb(253 230 138)';
export const STAGE_FRONT = 'rgb(217 119 6)';
const CAN = 'rgb(239 68 68)';

// Someone walking in from below, ending at (x, y).
export function Arrival({ x, y }: { x: number; y: number }) {
  return (
    <g
      className="pv-arrive"
      style={{ ...pv({ '--pv-at': '400ms', '--pv-from-y': '8px' }), ...FILL_BOX }}
      opacity="0"
    >
      <circle cx={x} cy={y} r="1.3" fill="rgb(251 191 146)" />
      <rect x={x - 1.2} y={y + 1.1} width="2.4" height="2.4" rx="0.4" fill={SHIRT} />
    </g>
  );
}

// A tree seen from above: a round canopy with a lighter crown.
export const Tree = ({ x, y, r = 4 }: { x: number; y: number; r?: number }) => (
  <>
    <circle cx={x} cy={y} r={r} fill={TREE} />
    <circle cx={x - r * 0.25} cy={y - r * 0.25} r={r * 0.55} fill={LEAF} />
  </>
);

// A sofa on its rug.
const Lounge = ({ x, y }: { x: number; y: number }) => (
  <>
    <ellipse cx={x + 7} cy={y + 4} rx="7" ry="3.4" fill={RUG} />
    <rect x={x + 1.5} y={y + 2.5} width="11" height="3" rx="1" fill={FURNITURE} />
  </>
);

// A row of bar stools, small round seats.
export const Stools = ({ xs, y }: { xs: readonly number[]; y: number }) => (
  <>
    {xs.map((x) => (
      <circle key={x} cx={x} cy={y} r="1.3" fill={FURNITURE} stroke={WALL} strokeWidth="0.3" />
    ))}
  </>
);

// A bar counter: its wooden front under a dark top.
export const Bar = ({ x, y, w }: { x: number; y: number; w: number }) => (
  <>
    <rect x={x} y={y} width={w} height="5" rx="0.8" fill={WOOD} />
    <rect x={x} y={y + 4} width={w} height="2" rx="0.6" fill={COUNTER} />
  </>
);

// A drinks fridge of red cans.
const Fridge = ({ x, y }: { x: number; y: number }) => (
  <>
    <rect
      x={x}
      y={y}
      width="5"
      height="8"
      rx="0.6"
      fill={FURNITURE}
      stroke={WALL}
      strokeWidth="0.3"
    />
    {[2, 4.5, 7].map((dy) => (
      <rect key={dy} x={x + 1} y={y + dy - 1} width="3" height="1" fill={CAN} />
    ))}
  </>
);

// A meeting table with a chair at each end of both long sides.
const Table = ({ x, y, w = 15, h = 9 }: { x: number; y: number; w?: number; h?: number }) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx="1.2" fill={FURNITURE} />
    {[x + 2, x + w - 4.4].map((cx) => (
      <rect key={`t${cx}`} x={cx} y={y - 2.2} width="2.4" height="1.6" fill={WALL} />
    ))}
    {[x + 2, x + w - 4.4].map((cx) => (
      <rect key={`b${cx}`} x={cx} y={y + h + 0.6} width="2.4" height="1.6" fill={WALL} />
    ))}
  </>
);

export function templatePreviewGroup24(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'focus-library':
      // Shelves along the back, study desks before them, two pods at the back right and a reading corner.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Room x={3} y={4} w={74} h={42} door="bottom" />
          {[6, 15, 24.5, 34].map((x) => (
            <rect key={`s${x}`} x={x} y={7} width="8" height="5" rx="0.6" fill={WOOD} />
          ))}
          {[6, 15, 24.5, 34].map((x) => (
            <rect key={`d${x}`} x={x} y={20} width="8" height="3.5" rx="0.6" fill={FURNITURE} />
          ))}
          {[48.5, 62.5].map((x) => (
            <rect
              key={x}
              x={x}
              y={7}
              width="11.5"
              height="9.5"
              rx="1"
              fill={POD}
              stroke={WALL}
              strokeWidth="0.5"
            />
          ))}
          {[50, 59.5].map((x) => (
            <rect key={`r${x}`} x={x} y={25} width="8" height="3.5" rx="0.6" fill={FURNITURE} />
          ))}
          <Lounge x={6} y={32} />
          <Plant x={30} y={36} />
          <Plant x={70} y={37} />
          <Arrival x={40} y={41} />
        </svg>
      );
    case 'training-room':
      // A small stage up front, Bring Focus beside it, and four tables either side of the aisle.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Room x={3} y={3} w={74} h={44} door="bottom" />
          <rect x={28} y={6} width="24" height="6" rx="1" fill={STAGE_TOP} />
          <rect x={28} y={11} width="24" height="2.2" rx="0.6" fill={STAGE_FRONT} />
          <rect x={55} y={7} width="7" height="5" rx="1" fill="rgb(129 140 248)" />
          <Table x={9} y={21} />
          <Table x={56} y={21} />
          <Table x={9} y={35} />
          <Table x={56} y={35} />
          <Plant x={70} y={8} />
          <Arrival x={40} y={41} />
        </svg>
      );
    case 'rooftop-bar':
      // The bar along the back with its stools, a cabinet and a fridge either side, trees in the corners, two lounges.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Room x={3} y={4} w={74} h={42} door="bottom" />
          <Tree x={9} y={10} />
          <Tree x={71} y={10} />
          <rect x={16} y={7} width="5.5" height="8" rx="0.6" fill={WOOD} />
          <Bar x={24} y={7} w={32} />
          <Fridge x={58} y={7} />
          <Stools xs={[26, 30, 34, 38, 42, 46, 50, 54]} y={17} />
          <Lounge x={7} y={31} />
          <Lounge x={59} y={31} />
          <Plant x={32} y={40} />
          <Plant x={46} y={40} />
          <Arrival x={40} y={41} />
        </svg>
      );
    case 'cafe':
      // The counter with its stools, the coffee machine and the fridge, two tables, a table for two and a sofa nook.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Room x={3} y={4} w={74} h={42} door="bottom" />
          <Bar x={6} y={7} w={18} />
          <Stools xs={[8, 12.5, 17, 21.5]} y={17} />
          <rect
            x={27}
            y={8}
            width="4"
            height="5"
            rx="0.6"
            fill={FURNITURE}
            stroke={WALL}
            strokeWidth="0.3"
          />
          <Fridge x={33} y={7} />
          <Table x={52} y={10} />
          <Table x={52} y={27} />
          <rect x={29} y={27} width="3.4" height="3.4" rx="0.6" fill={FURNITURE} />
          <rect x={36} y={27} width="3.4" height="3.4" rx="0.6" fill={FURNITURE} />
          <Lounge x={7} y={34} />
          <Plant x={72} y={39} />
          <Arrival x={40} y={41} />
        </svg>
      );
    case 'garden-retreat':
      // A fenced lawn, the gate at the bottom, a path up to the summer house, trees, a pond, a bench and a campfire.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect x={3} y={3} width="74" height="44" rx="2" fill={GRASS} />
          <path
            d="M35 47H3V3H77V47H45"
            fill="none"
            stroke={PICKET}
            strokeWidth="1"
            strokeDasharray="1.2 0.8"
          />
          <rect x={38} y={27} width="4" height="20" fill={PATH} />
          <rect x={15} y={32} width="23" height="4" fill={PATH} />
          <rect x={42} y={32} width="23" height="4" fill={PATH} />
          <Room x={30} y={6} w={20} h={21} door="bottom" />
          <Table x={33} y={10} w={14} h={7} />
          <Tree x={9} y={12} />
          <Tree x={22} y={19} />
          <Tree x={63} y={10} />
          <Tree x={70} y={22} />
          {/* The pond under the trees, the bench, and two chairs round the campfire. */}
          <ellipse
            cx={9.5}
            cy={27.5}
            rx="5"
            ry="2.6"
            fill="rgb(125 211 252)"
            stroke={WALL}
            strokeWidth="0.3"
          />
          <rect x={10} y={38} width="9" height="3" rx="1" fill={WOOD} />
          {[54, 63].map((x) => (
            <rect key={x} x={x} y={38} width="3.4" height="3.4" rx="0.6" fill={FURNITURE} />
          ))}
          <circle cx={60.5} cy={39.5} r="1.6" fill="rgb(249 115 22)" />
          <Arrival x={40} y={43} />
        </svg>
      );
    case 'city-park':
      // A lawn crossed by two paths, trees, benches, a picnic table, a fountain and a bandstand with seats.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <rect x={3} y={3} width="74" height="44" rx="2" fill={GRASS} />
          <rect x={3} y={23} width="74" height="4" fill={PATH} />
          <rect x={38} y={3} width="4" height="44" fill={PATH} />
          <Tree x={9} y={9} />
          <Tree x={20} y={14} />
          <Tree x={71} y={9} />
          <Tree x={60} y={13} />
          {[27, 44].map((x) => (
            <rect key={x} x={x} y={18} width="9" height="3" rx="1" fill={WOOD} />
          ))}
          <Table x={10} y={33} w={14} h={8} />
          <Tree x={30} y={38} />
          <circle
            cx={45.5}
            cy={31}
            r="1.8"
            fill="rgb(186 230 253)"
            stroke={WALL}
            strokeWidth="0.3"
          />
          <rect x={51} y={30} width="22" height="6" rx="1" fill={STAGE_TOP} />
          <rect x={51} y={35} width="22" height="2" rx="0.6" fill={STAGE_FRONT} />
          {[53, 58, 63, 68].map((x) => (
            <rect key={x} x={x} y={40} width="3.4" height="3.4" rx="0.6" fill={FURNITURE} />
          ))}
          <Arrival x={40} y={42} />
        </svg>
      );
    default:
      return null;
  }
}
