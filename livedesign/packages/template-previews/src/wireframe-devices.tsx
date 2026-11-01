import type { ReactNode } from 'react';

// The devices the wireframe previews draw small (template-preview-26 and the flows' previews): a body, its screen
// inset, and what the screen holds. Shared so every wireframe tile draws the same iPhone, iPad, browser, laptop and
// watch.
export const BODY = 'rgb(30 41 59)';
export const SCREEN = 'white';
export const BAR = 'rgb(203 213 225)';
export const INK = 'rgb(51 65 85)';
export const PIC = 'rgb(226 232 240)';
export const SKY = 'rgb(14 165 233)';

export type Box = { x: number; y: number; w: number; h: number };

// A device drawn small: its body, its screen inset, and what the screen holds.
export function Phone({ x, y, w, h, children }: Box & { children?: ReactNode }) {
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

export function Tablet({ x, y, w, h, children }: Box & { children?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2.5" fill={BODY} />
      <rect x={x + 1.6} y={y + 1.6} width={w - 3.2} height={h - 3.2} rx="1.2" fill={SCREEN} />
      {children}
    </g>
  );
}

export function Browser({ x, y, w, h, children }: Box & { children?: ReactNode }) {
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

export function Laptop({ x, y, w, h, children }: Box & { children?: ReactNode }) {
  return (
    <g>
      <rect x={x + 3} y={y} width={w - 6} height={h - 2} rx="1.6" fill={BODY} />
      <rect x={x + 4.2} y={y + 1.4} width={w - 8.4} height={h - 4} fill={SCREEN} />
      <rect x={x} y={y + h - 2} width={w} height="2" rx="1" fill="rgb(100 116 139)" />
      {children}
    </g>
  );
}

export function Watch({ x, y, w, h, children }: Box & { children?: ReactNode }) {
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
