import type { ReactNode } from 'react';
import { Shadow, Stage } from '../parts';

/** A device's screen, in stage units: what a product's `screen` draws into. */
export type ScreenBox = { x: number; y: number; w: number; h: number };

// The white glass every screen starts as, with the product's work drawn on top. Nothing clips it, so the product
// keeps its drawing inside the box it is handed.
function Screen({ box, screen }: { box: ScreenBox; screen: (box: ScreenBox) => ReactNode }) {
  return (
    <g>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={3} className="fill-white" />
      {screen(box)}
    </g>
  );
}

// Supported Devices: one piece of work on a computer, a tablet and a phone. The three devices are the same in every
// product; the product draws its own work on each screen (`screen`, called once per screen with its box), scaled
// to the box so it reads the same at each size.
export function SupportedDevicesArt({ screen }: { screen: (box: ScreenBox) => ReactNode }) {
  return (
    <Stage>
      {/* Laptop. */}
      <Shadow x={34} y={34} w={212} h={136} r={10} />
      <rect
        x={34}
        y={34}
        width={212}
        height={136}
        rx={10}
        className="fill-slate-800 stroke-slate-600 help-art-as-drawn"
        strokeWidth={1.5}
      />
      <Screen box={{ x: 42, y: 42, w: 196, h: 120 }} screen={screen} />
      <path d="M14 176 H266 l-12 12 H26 Z" className="fill-slate-300" />
      <rect
        x={14}
        y={170}
        width={252}
        height={8}
        rx={3}
        className="fill-slate-200 stroke-slate-300"
        strokeWidth={1}
      />
      <rect x={118} y={170} width={44} height={4} rx={2} className="fill-slate-300" />

      {/* Tablet. */}
      <Shadow x={232} y={64} w={104} h={134} r={12} />
      <rect
        x={232}
        y={64}
        width={104}
        height={134}
        rx={12}
        className="fill-slate-800 stroke-slate-600 help-art-as-drawn"
        strokeWidth={1.5}
      />
      <Screen box={{ x: 240, y: 72, w: 88, h: 118 }} screen={screen} />

      {/* Phone. */}
      <Shadow x={318} y={98} w={62} h={110} r={12} />
      <rect
        x={318}
        y={98}
        width={62}
        height={110}
        rx={12}
        className="fill-slate-800 stroke-slate-600 help-art-as-drawn"
        strokeWidth={1.5}
      />
      <Screen box={{ x: 323, y: 108, w: 52, h: 92 }} screen={screen} />
      <rect
        x={340}
        y={102}
        width={18}
        height={3}
        rx={1.5}
        className="fill-slate-600 help-art-as-drawn"
      />
    </Stage>
  );
}
