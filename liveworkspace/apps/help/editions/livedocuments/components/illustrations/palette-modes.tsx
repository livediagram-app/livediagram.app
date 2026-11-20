// Selection-mode scenes (liveworkspace/docs/specs/017-help/help-centre.md): the palette strip's selection mode set to
// Select, Hand, Format or Laser over a slide on livedocuments' canvas, and the palette settings shown on the canvas
// (Panel Opacity, Auto-Attach Arrows). The strip is ./editor-chrome's, the pages ./doc-page's.

import { lucideHand, lucidePaintbrush } from '@liveworkspace/icons/lucide';
import { Arrow, Label, Panel, Scene, SelectionBox, Shape } from '@liveworkspace/help-site/art/primitives';
import { Icon } from './editor-chrome';
import { BarChart, Heading, Lines, Page, Pointer, Rule, SlideContent } from './doc-page';
import { PickerTrigger } from './selection-modes';

/** The slide most mode scenes work on, under the strip: a title, its text, and a chart. */
function ModeSlide({ x = 72, y = 62 }: { x?: number; y?: number }) {
  return (
    <Page x={x} y={y} w={276} h={155} name="Results">
      <Heading x={x + 20} y={y + 24} size={13}>
        Q3 Results
      </Heading>
      <Rule x={x + 20} y={y + 34} />
      <Lines x={x + 20} y={y + 48} w={96} n={4} gap={7} />
      <BarChart x={x + 150} y={y + 22} w={106} h={110} />
    </Page>
  );
}

/** Select mode: the strip's selection mode on Select, and the chart selected with its handles. */
export function SelectMode() {
  return (
    <Scene w={420} h={230}>
      <PickerTrigger tool="select" />
      <ModeSlide />
      <SelectionBox x={218} y={80} w={114} h={120} />
      <Pointer x={286} y={150} />
    </Scene>
  );
}

/** Hand mode: the strip's selection mode on Hand, and the grabbing hand panning the canvas, a faint trail behind it. */
export function HandMode() {
  return (
    <Scene w={420} h={230}>
      <PickerTrigger tool="hand" />
      <ModeSlide />
      <path
        d="M150 196 q40 -14 80 -10"
        className="stroke-slate-400"
        strokeWidth={1.25}
        fill="none"
        strokeDasharray="3 3"
        strokeLinecap="round"
      />
      <Icon prims={lucideHand} x={242} y={186} size={16} className="stroke-slate-800" />
    </Scene>
  );
}

/** Format mode: the strip's selection mode on Format, the brush carrying the styled card's look onto the plain one. */
export function FormatPainterMode() {
  return (
    <Scene w={420} h={220}>
      <PickerTrigger tool="format" />
      <Page x={56} y={62} w={308} h={140} name="Pricing">
        <Heading x={74} y={82} size={11}>
          Choose a Plan
        </Heading>
        <Shape x={74} y={100} w={108} h={74} accent />
        <Label x={88} y={118} size={10} weight={700} tone="onAccent">
          Team
        </Label>
        <Shape x={238} y={100} w={108} h={74} />
        <Label x={252} y={118} size={10} weight={700} tone="strong">
          Personal
        </Label>
      </Page>
      <path
        d="M186 112 C 200 90, 220 90, 234 110"
        className="fill-none stroke-brand-400"
        strokeWidth={1.25}
        strokeDasharray="3 3"
      />
      <Icon prims={lucidePaintbrush} x={262} y={152} size={15} className="stroke-slate-800" />
    </Scene>
  );
}

/** Laser mode: the strip's selection mode on Laser, and the trail fading behind the pointer as it circles the
 *  tallest bar. */
export function LaserMode() {
  return (
    <Scene w={420} h={230}>
      <PickerTrigger tool="laser" />
      <ModeSlide />
      <path
        d="M120 196 q60 20 120 -10 q40 -20 70 -76"
        className="stroke-rose-200"
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M262 168 q32 -22 48 -58"
        className="stroke-rose-400"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={310} cy={110} r={8} className="fill-rose-400/30" />
      <circle cx={310} cy={110} r={4.5} className="fill-rose-500" />
    </Scene>
  );
}

/** Panel Opacity: the Format panel, set translucent, lets the slide behind it show through. */
export function PanelOpacity() {
  return (
    <Scene w={400} h={220}>
      <Page x={24} y={40} w={250} h={141} name="Cover">
        <SlideContent x={24} y={40} w={250} h={141} title="Field Guide" layout="picture" />
      </Page>
      <g opacity={0.62}>
        <Panel x={206} y={58} w={170} h={138} title="Format">
          <rect x={218} y={90} width={146} height={8} rx={4} className="fill-slate-200" />
          <rect x={218} y={108} width={44} height={34} rx={5} className="fill-slate-100" />
          <rect x={268} y={108} width={44} height={34} rx={5} className="fill-slate-100" />
          <rect x={318} y={108} width={44} height={34} rx={5} className="fill-slate-100" />
          <rect x={218} y={152} width={110} height={8} rx={4} className="fill-slate-200" />
        </Panel>
      </g>
    </Scene>
  );
}

/** Auto-Attach Arrows on an infographic: the second step is dragged from the right of the first to its left, and both
 *  ends of the arrow move to the sides that now face each other. */
export function AutoAttachArrows() {
  return (
    <Scene w={420} h={190}>
      <Page x={14} y={36} w={392} h={140} name="How It Works" rest="A4">
        <Heading x={30} y={56} size={11}>
          How It Works
        </Heading>
        <Shape x={166} y={96} w={88} h={44} label="Plan" />
        <Shape
          x={302}
          y={96}
          w={88}
          h={44}
          dashed
          fill="fill-slate-50"
          stroke="stroke-slate-300"
        />
        <Arrow from={[254, 118]} to={[302, 118]} tone="muted" dashed />
        <Shape x={30} y={96} w={88} h={44} accent label="Write" labelTone="onAccent" />
        <Arrow from={[166, 118]} to={[118, 118]} tone="accent" />
        <path
          d="M346 92 Q210 46 74 92"
          className="stroke-slate-300"
          strokeWidth={1.25}
          fill="none"
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
      </Page>
    </Scene>
  );
}
