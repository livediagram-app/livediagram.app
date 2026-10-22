import type { ReactElement, ReactNode } from 'react';
import type { TemplateKind } from '@livedesign/templates';
import { pv } from './motion';

// Group 26: the wireframes on wireframe pages (docs/specs/007-editor/wireframe-pages.md "Templates"):
// the five blank wireframes, each its device with an empty screen and the "+" that starts it, and the five flows,
// each a row of its device holding screens. Hover story: the screens' primary buttons light up in turn.
// Static SVG preview tiles, one branch per TemplateKind; TemplatePreview chains the groups with ??.

const BODY = 'rgb(30 41 59)';
const SCREEN = 'white';
const BAR = 'rgb(203 213 225)';
const INK = 'rgb(51 65 85)';
const PIC = 'rgb(226 232 240)';
const SKY = 'rgb(14 165 233)';

type Box = { x: number; y: number; w: number; h: number };

// A device drawn small: its body, its screen inset, and what the screen holds.
function Phone({ x, y, w, h, children }: Box & { children?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={w * 0.2} fill={BODY} />
      <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx={w * 0.16} fill={SCREEN} />
      <rect
        x={x + w / 2 - w * 0.15}
        y={y + 1.8}
        width={w * 0.3}
        height="1.2"
        rx="0.6"
        fill={BODY}
      />
      {children}
    </g>
  );
}

function Tablet({ x, y, w, h, children }: Box & { children?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2.5" fill={BODY} />
      <rect x={x + 1.6} y={y + 1.6} width={w - 3.2} height={h - 3.2} rx="1.2" fill={SCREEN} />
      {children}
    </g>
  );
}

function Browser({ x, y, w, h, children }: Box & { children?: ReactNode }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="2"
        fill="rgb(241 245 249)"
        stroke={BAR}
        strokeWidth="0.5"
      />
      <rect x={x + 0.3} y={y + 4} width={w - 0.6} height={h - 4.3} fill={SCREEN} />
      <circle cx={x + 2} cy={y + 2} r="0.7" fill="rgb(248 113 113)" />
      <circle cx={x + 4} cy={y + 2} r="0.7" fill="rgb(251 191 36)" />
      <circle cx={x + 6} cy={y + 2} r="0.7" fill="rgb(74 222 128)" />
      <rect x={x + 9} y={y + 1.2} width={w - 13} height="1.6" rx="0.8" fill={SCREEN} />
      {children}
    </g>
  );
}

function Laptop({ x, y, w, h, children }: Box & { children?: ReactNode }) {
  return (
    <g>
      <rect x={x + 3} y={y} width={w - 6} height={h - 2} rx="1.6" fill={BODY} />
      <rect x={x + 4.2} y={y + 1.4} width={w - 8.4} height={h - 4} fill={SCREEN} />
      <rect x={x} y={y + h - 2} width={w} height="2" rx="1" fill="rgb(100 116 139)" />
      {children}
    </g>
  );
}

function Watch({ x, y, w, h, children }: Box & { children?: ReactNode }) {
  return (
    <g>
      <rect x={x + w * 0.2} y={y} width={w * 0.6} height={h} rx="1.5" fill="rgb(71 85 105)" />
      <rect x={x} y={y + h * 0.2} width={w} height={h * 0.6} rx={w * 0.28} fill={BODY} />
      <rect
        x={x + 1.2}
        y={y + h * 0.2 + 1.2}
        width={w - 2.4}
        height={h * 0.6 - 2.4}
        rx={w * 0.22}
        fill={SCREEN}
      />
      {children}
    </g>
  );
}

// The "+" that starts a blank, as on the other blanks, a ring pulsing round it on hover.
function Plus({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <circle
        className="pv-pulse"
        cx={cx}
        cy={cy}
        r="4.5"
        fill="none"
        stroke={SKY}
        strokeWidth="0.6"
        strokeDasharray="1.4 1"
        style={pv({ '--pv-at': '400ms' })}
      />
      <circle cx={cx} cy={cy} r="2" fill={SKY} />
      <path
        d={`M${cx} ${cy - 1.1} V${cy + 1.1} M${cx - 1.1} ${cy} H${cx + 1.1}`}
        stroke="white"
        strokeWidth="0.6"
      />
    </>
  );
}

// A screen's content, small: a title bar, a picture, two lines and a button that lights on hover.
function Screen({ x, y, w, h, at }: Box & { at: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w * 0.6} height="1.4" rx="0.7" fill={INK} />
      <rect x={x} y={y + 3} width={w} height={h * 0.38} rx="0.8" fill={PIC} />
      <rect x={x} y={y + 4 + h * 0.38} width={w * 0.9} height="1" rx="0.5" fill={BAR} />
      <rect x={x} y={y + 6 + h * 0.38} width={w * 0.6} height="1" rx="0.5" fill={BAR} />
      <rect
        className="pv-pulse"
        x={x}
        y={y + h - 3}
        width={w}
        height="2.6"
        rx="1"
        fill={INK}
        style={pv({ '--pv-at': `${at}ms` })}
      />
    </g>
  );
}

const svg = (children: ReactNode) => (
  <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
    {children}
  </svg>
);

export function templatePreviewGroup26(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'blank-wireframe-phone':
      return svg(
        <Phone x={30} y={3} w={20} h={44}>
          <Plus cx={40} cy={25} />
        </Phone>,
      );
    case 'blank-wireframe-tablet':
      return svg(
        <Tablet x={24} y={4} w={32} h={42}>
          <Plus cx={40} cy={25} />
        </Tablet>,
      );
    case 'blank-wireframe-browser':
      return svg(
        <Browser x={12} y={7} w={56} h={36}>
          <Plus cx={40} cy={27} />
        </Browser>,
      );
    case 'blank-wireframe-laptop':
      return svg(
        <Laptop x={12} y={8} w={56} h={34}>
          <Plus cx={40} cy={24} />
        </Laptop>,
      );
    case 'blank-wireframe-watch':
      return svg(
        <Watch x={30} y={4} w={20} h={42}>
          <Plus cx={40} cy={25} />
        </Watch>,
      );
    case 'wireframe-mobile-app':
      return svg(
        <>
          {[0, 1, 2, 3].map((i) => (
            <Phone key={i} x={5 + i * 18.5} y={6} w={15} h={38}>
              <Screen x={7.5 + i * 18.5} y={11} w={10} h={30} at={200 + i * 250} />
            </Phone>
          ))}
        </>,
      );
    case 'wireframe-website':
      return svg(
        <>
          {[0, 1].map((i) => (
            <Browser key={i} x={4 + i * 37} y={11} w={35} h={28}>
              <Screen x={7 + i * 37} y={17} w={29} h={20} at={200 + i * 400} />
            </Browser>
          ))}
        </>,
      );
    case 'wireframe-dashboard':
      return svg(
        <>
          {[0, 1].map((i) => (
            <Laptop key={i} x={3 + i * 38} y={12} w={36} h={26}>
              <rect x={8.6 + i * 38} y={15} width="5" height="17" rx="0.6" fill={PIC} />
              <Screen x={15 + i * 38} y={15} w={17} h={18} at={200 + i * 400} />
            </Laptop>
          ))}
        </>,
      );
    case 'wireframe-tablet-app':
      return svg(
        <>
          {[0, 1, 2].map((i) => (
            <Tablet key={i} x={6 + i * 23.5} y={9} w={21} h={32}>
              <Screen x={9 + i * 23.5} y={13} w={15} h={25} at={200 + i * 300} />
            </Tablet>
          ))}
        </>,
      );
    case 'wireframe-watch-app':
      return svg(
        <>
          {[0, 1, 2].map((i) => (
            <Watch key={i} x={12 + i * 20} y={8} w={16} h={34}>
              <circle
                className="pv-pulse"
                cx={20 + i * 20}
                cy={25}
                r="4"
                fill="none"
                stroke={SKY}
                strokeWidth="1.2"
                style={pv({ '--pv-at': `${200 + i * 300}ms` })}
              />
            </Watch>
          ))}
        </>,
      );
    default:
      return null;
  }
}
