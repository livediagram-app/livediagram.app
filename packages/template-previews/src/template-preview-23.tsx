import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';

// Group 23: the Virtual Office (docs/specs/012-collaboration/virtual-office-template.md): a floor plan of rooms
// either side of a corridor, a meeting table, desks, plants and a coffee machine. Its hover story: a character
// walks in from the corridor.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const WALL = 'rgb(148 163 184)';
const FLOOR = 'rgb(245 240 230)';
const FURNITURE = 'rgb(203 213 225)';
const LEAF = 'rgb(74 222 128)';
const POT = 'rgb(234 88 12)';
const SHIRT = 'rgb(20 184 166)';

// A room's walls, broken by a doorway on the corridor side (top or bottom).
function Room({
  x,
  y,
  w,
  h,
  door,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  door: 'top' | 'bottom';
}) {
  const mid = x + w / 2;
  const doorY = door === 'top' ? y : y + h;
  const otherY = door === 'top' ? y + h : y;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={FLOOR} />
      <path
        d={`M${mid - 3} ${doorY}L${x} ${doorY}L${x} ${otherY}L${x + w} ${otherY}L${x + w} ${doorY}L${mid + 3} ${doorY}`}
        fill="none"
        stroke={WALL}
        strokeWidth="0.9"
      />
    </>
  );
}

const Plant = ({ x, y }: { x: number; y: number }) => (
  <>
    <circle cx={x} cy={y} r="1.6" fill={LEAF} />
    <rect x={x - 1} y={y + 1.2} width="2" height="1.6" fill={POT} />
  </>
);

export function templatePreviewGroup23(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'virtual-office':
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Room x={3} y={4} w={22} h={18} door="bottom" />
          <Room x={28} y={4} w={26} h={18} door="bottom" />
          <Room x={57} y={4} w={20} h={18} door="bottom" />
          <Room x={3} y={28} w={24} h={18} door="top" />
          <Room x={30} y={28} w={24} h={18} door="top" />
          <Room x={57} y={28} w={20} h={18} door="top" />
          {/* Reception: a sofa and a plant. */}
          <rect x={8} y={8} width="10" height="3" rx="1" fill={FURNITURE} />
          <Plant x={21} y={8} />
          {/* Desks. */}
          {[31, 39, 47].map((x) => (
            <rect key={x} x={x} y={8} width="5" height="3" rx="0.6" fill={FURNITURE} />
          ))}
          {[31, 39, 47].map((x) => (
            <rect key={`b${x}`} x={x} y={15} width="5" height="3" rx="0.6" fill={FURNITURE} />
          ))}
          {/* The meeting table and its chairs. */}
          <rect x={61} y={11} width="12" height="5" rx="1" fill={FURNITURE} />
          {[63, 69].map((x) => (
            <rect key={x} x={x} y={8.5} width="2.4" height="1.6" fill={WALL} />
          ))}
          {[63, 69].map((x) => (
            <rect key={`n${x}`} x={x} y={17} width="2.4" height="1.6" fill={WALL} />
          ))}
          {/* Kitchen: the cooler and the coffee machine. */}
          <rect x={6} y={33} width="3" height="5" rx="0.6" fill="rgb(186 230 253)" />
          <rect x={11} y={34} width="4" height="4" rx="0.6" fill={FURNITURE} />
          <Plant x={23} y={34} />
          {/* Lounge: a rug and a sofa. */}
          <ellipse cx={42} cy={41} rx="7" ry="3" fill="rgb(253 230 138)" />
          <rect x={36} y={32} width="12" height="3" rx="1" fill={FURNITURE} />
          {/* Focus room. */}
          <rect x={64} y={35} width="5" height="3" rx="0.6" fill={FURNITURE} />
          <Plant x={73} y={41} />
          {/* Someone walks in from the corridor. */}
          <g
            className="pv-arrive"
            style={pv({ '--pv-at': '400ms', '--pv-from-x': '-16px' })}
            opacity="0"
          >
            <circle cx="40" cy="23.5" r="1.3" fill="rgb(251 191 146)" />
            <rect x="38.8" y="24.6" width="2.4" height="2.4" rx="0.4" fill={SHIRT} />
          </g>
        </svg>
      );
    default:
      return null;
  }
}
