import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';
import { FILL_BOX } from './story-parts';

// Group 23: the Virtual Office and its sibling spaces (docs/specs/012-collaboration/virtual-office-template.md): floor plans of rooms
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
  door: 'top' | 'bottom' | 'left';
}) {
  const mid = x + w / 2;
  const doorY = door === 'top' ? y : y + h;
  const otherY = door === 'top' ? y + h : y;
  const midY = y + h / 2;
  // The walls round the room, broken by a doorway in the middle of the door's side.
  const walls =
    door === 'left'
      ? `M${x} ${midY - 3}L${x} ${y}L${x + w} ${y}L${x + w} ${y + h}L${x} ${y + h}L${x} ${midY + 3}`
      : `M${mid - 3} ${doorY}L${x} ${doorY}L${x} ${otherY}L${x + w} ${otherY}L${x + w} ${doorY}L${mid + 3} ${doorY}`;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={FLOOR} />
      <path d={walls} fill="none" stroke={WALL} strokeWidth="0.9" />
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
          {/* Reception: a sofa on its rug at the back, and a plant. */}
          <ellipse cx={13} cy={10} rx="7" ry="3" fill="rgb(253 230 138)" />
          <rect x={8} y={8.5} width="10" height="3" rx="1" fill={FURNITURE} />
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
          {/* Lounge: a sofa on its rug, well inside the door. */}
          <ellipse cx={42} cy={41} rx="7" ry="3" fill="rgb(253 230 138)" />
          <rect x={36} y={39.5} width="12" height="3" rx="1" fill={FURNITURE} />
          {/* Focus room. */}
          <rect x={64} y={35} width="5" height="3" rx="0.6" fill={FURNITURE} />
          <Plant x={73} y={41} />
          {/* Someone walks in from the corridor. */}
          <g
            className="pv-arrive"
            style={{ ...pv({ '--pv-at': '400ms', '--pv-from-x': '-16px' }), ...FILL_BOX }}
            opacity="0"
          >
            <circle cx="40" cy="23.5" r="1.3" fill="rgb(251 191 146)" />
            <rect x="38.8" y="24.6" width="2.4" height="2.4" rx="0.4" fill={SHIRT} />
          </g>
        </svg>
      );
    case 'coworking-space':
      // An open floor of desk clusters, two booths inside it on the right opening onto the floor, a coffee bar and a
      // lounge rug.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Room x={3} y={4} w={74} h={42} door="bottom" />
          <Room x={60} y={7} w={14} h={15} door="left" />
          <Room x={60} y={26} w={14} h={15} door="left" />
          {[7, 27].map((x) =>
            [9, 15].map((y) => (
              <rect key={`${x}-${y}`} x={x} y={y} width="16" height="4" rx="0.8" fill={FURNITURE} />
            )),
          )}
          <rect x={65} y={12} width="6" height="4" rx="0.8" fill={FURNITURE} />
          <rect x={65} y={31} width="6" height="4" rx="0.8" fill={FURNITURE} />
          <rect x={7} y={34} width="4" height="4" rx="0.6" fill={FURNITURE} />
          <rect x={13} y={33} width="3" height="5" rx="0.6" fill="rgb(186 230 253)" />
          <ellipse cx={38} cy={38} rx="9" ry="4" fill="rgb(253 230 138)" />
          <rect x={31} y={30} width="14" height="3" rx="1" fill={FURNITURE} />
          <Plant x={52} y={39} />
          <g
            className="pv-arrive"
            style={pv({ '--pv-at': '400ms', '--pv-from-y': '10px' })}
            opacity="0"
          >
            <circle cx="40" cy="43" r="1.3" fill="rgb(251 191 146)" />
            <rect x="38.8" y="44.1" width="2.4" height="2.4" rx="0.4" fill={SHIRT} />
          </g>
        </svg>
      );
    case 'team-pod':
      // One room: four desks together and a table, the team board beside it.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Room x={3} y={6} w={50} h={38} door="bottom" />
          {[8, 18].map((x) =>
            [11, 17].map((y) => (
              <rect key={`${x}-${y}`} x={x} y={y} width="8" height="4" rx="0.8" fill={FURNITURE} />
            )),
          )}
          <rect x={31} y={12} width="16" height="8" rx="1.2" fill={FURNITURE} />
          <rect x={8} y={31} width="4" height="4" rx="0.6" fill={FURNITURE} />
          <Plant x={45} y={34} />
          {[
            { x: 58, y: 8, fill: 'rgb(254 240 138)' },
            { x: 68, y: 8, fill: 'rgb(186 230 253)' },
            { x: 58, y: 19, fill: 'rgb(254 205 211)' },
            { x: 68, y: 19, fill: 'rgb(187 247 208)' },
          ].map((n) => (
            <rect key={`${n.x}-${n.y}`} x={n.x} y={n.y} width="9" height="9" rx="1" fill={n.fill} />
          ))}
          <g
            className="pv-arrive"
            style={{ ...pv({ '--pv-at': '400ms', '--pv-from-y': '10px' }), ...FILL_BOX }}
            opacity="0"
          >
            <circle cx="28" cy="40" r="1.3" fill="rgb(251 191 146)" />
            <rect x="26.8" y="41.1" width="2.4" height="2.4" rx="0.4" fill={SHIRT} />
          </g>
        </svg>
      );
    case 'all-hands-hall':
      // A stage up front and rows of seats either side of an aisle.
      return (
        <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
          <Room x={6} y={3} w={68} h={44} door="bottom" />
          <rect x={26} y={7} width="28" height="7" rx="2" fill="rgb(253 230 138)" />
          {[20, 26, 32, 38].map((y) =>
            [12, 18, 24, 30, 46, 52, 58, 64].map((x) => (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width="4"
                height="3.4"
                rx="0.6"
                fill={FURNITURE}
              />
            )),
          )}
          {/* In through the doorway at the back of the hall, up the aisle. */}
          <g
            className="pv-arrive"
            style={pv({ '--pv-at': '400ms', '--pv-from-y': '8px' })}
            opacity="0"
          >
            <circle cx="40" cy="41" r="1.3" fill="rgb(251 191 146)" />
            <rect x="38.8" y="42.1" width="2.4" height="2.4" rx="0.4" fill={SHIRT} />
          </g>
        </svg>
      );
    default:
      return null;
  }
}
