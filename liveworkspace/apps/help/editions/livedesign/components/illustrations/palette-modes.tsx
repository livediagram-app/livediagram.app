// The canvas tools in use on livedesign's pages (liveworkspace/docs/specs/017-help/help-centre.md): the palette
// strip at the top with its select-mode pill showing the current tool (Select, Hand, Eraser, Format, Laser), then
// what that tool does to a page; plus Panel Opacity and Auto-Attach Arrows. The strip is the chrome kit's.

import { Arrow, Scene, SelectionBox, Shape } from '@liveworkspace/help-site/art/primitives';
import { PickerTrigger } from './selection-modes';
import { DesignPage, PagesRail } from './editor-frame';
import { ModeScreen, phoneThumb } from './design-content';
import { GrabHand } from './canvas';

/** Select: the pill on Select, and the screen's button selected with its handles. */
export function SelectMode() {
  return (
    <Scene w={420} h={240}>
      <PickerTrigger tool="select" />
      <ModeScreen x={162} y={64} />
      <SelectionBox x={167} y={206} w={86} h={15} />
    </Scene>
  );
}

/** Hand: the pill on Hand, and the grabbing hand dragging the canvas along. */
export function HandMode() {
  return (
    <Scene w={420} h={240}>
      <PickerTrigger tool="hand" />
      <ModeScreen x={110} y={64} variant="home" cta="Shop Now" />
      <path
        d="M232 170 q40 -14 76 -4"
        className="stroke-slate-300"
        strokeWidth={1}
        fill="none"
        strokeDasharray="3 3"
        strokeLinecap="round"
      />
      <GrabHand x={316} y={150} />
    </Scene>
  );
}

/** Eraser: the pill on Eraser, and a sweep across a page's pencil marks, the crossed strokes going. */
export function EraserMode() {
  return (
    <Scene w={420} h={240}>
      <PickerTrigger tool="eraser" />
      <DesignPage x={110} y={64} w={200} h={150} size="A4 · Landscape" bare>
        <path
          d="M130 110 q30 -30 60 0 t60 0"
          className="stroke-slate-700"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M140 160 q20 -18 40 0"
          className="stroke-slate-300"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
        <path
          d="M200 170 l30 -20"
          className="stroke-slate-300"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
      </DesignPage>
      <path
        d="M130 172 L250 156"
        className="stroke-rose-400"
        strokeWidth={1.5}
        fill="none"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
      <circle
        cx={256}
        cy={156}
        r={11}
        className="fill-rose-400/20 stroke-rose-500"
        strokeWidth={1}
      />
    </Scene>
  );
}

/** The format painter's brush. */
export function Brush({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-6} y={-8} width={12} height={6} rx={1} className="fill-brand-500" />
      <path
        d="M0 -2 v4 M-1.5 2 h3 v6 h-3 Z"
        className="fill-slate-500 stroke-slate-600"
        strokeWidth={1}
      />
    </g>
  );
}

/** Format: the pill on Format, copying the solid button's look onto the next screen's. */
export function FormatPainterMode() {
  return (
    <Scene w={420} h={240}>
      <PickerTrigger tool="format" />
      <ModeScreen x={90} y={64} variant="home" cta="Shop Now" />
      <ModeScreen x={236} y={64} variant="product" cta="Add to Cart" />
      <Arrow from={[180, 214]} to={[240, 214]} kind="curved" tone="muted" dashed width={1} />
      <Brush x={300} y={228} />
    </Scene>
  );
}

/** Laser: the pill on Laser, and a glowing trail fading behind the pointer as it sweeps to the button. */
export function LaserMode() {
  return (
    <Scene w={420} h={240}>
      <PickerTrigger tool="laser" />
      <ModeScreen x={162} y={64} />
      <path
        d="M120 140 q30 70 90 72"
        className="stroke-rose-200"
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M208 212 q40 2 60 -14"
        className="stroke-rose-400"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={268} cy={198} r={7} className="fill-rose-400/30" />
      <circle cx={268} cy={198} r={3.5} className="fill-rose-500" />
    </Scene>
  );
}

/** Panel opacity: the Pages rail turned translucent, so the page under it shows through. */
export function PanelOpacity() {
  return (
    <Scene w={400} h={240}>
      <DesignPage x={90} y={40} w={150} h={180} size="A4 · Portrait" bare>
        <rect x={104} y={56} width={122} height={60} rx={3} className="fill-brand-100" />
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={104}
            y={128 + i * 12}
            width={i === 3 ? 70 : 122}
            height={5}
            rx={2.5}
            className="fill-slate-200"
          />
        ))}
      </DesignPage>
      {/* The rail at 60%: the page panned under it still shows through. */}
      <g opacity={0.6}>
        <PagesRail
          h={240}
          pages={[
            { name: 'Home', thumb: phoneThumb('home') },
            { name: 'Product', thumb: phoneThumb('product') },
          ]}
          foot={false}
        />
      </g>
    </Scene>
  );
}

/** Auto-attach arrows: the target moved from the right of the source to its left, both ends move to the sides that
 *  now face each other. */
export function AutoAttachArrows() {
  return (
    <Scene w={420} h={220}>
      <Shape x={166} y={86} w={88} h={48} label="Source" />
      <Shape x={320} y={86} w={88} h={48} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
      <Arrow from={[254, 110]} to={[320, 110]} tone="muted" dashed />
      <Shape x={12} y={86} w={88} h={48} accent label="Target" />
      <Arrow from={[166, 110]} to={[100, 110]} tone="accent" />
      <path
        d="M364 80 Q210 -10 56 80"
        className="stroke-slate-300"
        strokeWidth={1}
        fill="none"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
    </Scene>
  );
}
