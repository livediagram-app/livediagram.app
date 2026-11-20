// Tab scenes in livedesign's own work (liveworkspace/docs/specs/017-help/help-centre.md): an element linking to
// another tab, and two tabs side by side (dragging one to the right edge, then both open with one bar under them).
// Built from the chrome kit (./editor-chrome) and the page content (./design-content).

import { Arrow, Cursor, Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { BottomBar, Card, HAIR } from './editor-chrome';
import { DesignPage } from './editor-frame';
import { LogoMark, PhoneScreen } from './design-content';

/** A linked button: its link badge on top, the hover card naming the target tab, and the bar with that tab. */
export function CrossTabLink() {
  return (
    <Scene w={420} h={236}>
      <DesignPage x={70} y={40} w={100} h={160} size="iPhone · Wireframe" bare>
        <PhoneScreen x={76} y={46} w={88} h={148} variant="home" cta="See Our Logo" frame={false} />
      </DesignPage>
      <circle cx={160} cy={168} r={7} className="fill-brand-500" />
      <path
        d="M157 171 l6 -6 M158.5 165 h4.5 v4.5"
        className="stroke-white help-art-as-drawn"
        strokeWidth={1.2}
        fill="none"
        strokeLinecap="round"
      />
      <Card x={172} y={136} w={118} h={36} r={6} />
      <Label x={182} y={148} size={9} weight={600} tone="strong">
        Follow Link
      </Label>
      <Label x={182} y={162} size={9} tone="muted">
        Goes to tab Brand
      </Label>
      <Arrow from={[230, 120]} to={[286, 72]} kind="curved" width={1.25} />
      <DesignPage x={292} y={40} w={84} h={84} size="Logo · Square" bare>
        <LogoMark cx={334} cy={76} r={17} />
      </DesignPage>
      <BottomBar y={212} w={420} tabs={['App Screens', 'Brand']} />
    </Scene>
  );
}

/** One pane of a side-by-side split: a page on the canvas. */
function PaneLogo({ x, y }: { x: number; y: number }) {
  return (
    <DesignPage x={x} y={y} w={86} h={86} size="Logo · Square" bare>
      <LogoMark cx={x + 43} cy={y + 37} r={17} />
    </DesignPage>
  );
}

/** Dragging the Brand tab to the right edge: the preview fills the right half and names what will open there. */
export function SideBySideDrag() {
  return (
    <Scene w={420} h={236}>
      <DesignPage x={60} y={40} w={84} h={150} size="iPhone · Wireframe" bare>
        <PhoneScreen x={66} y={46} w={72} h={138} variant="home" cta="Shop" frame={false} />
      </DesignPage>
      <rect
        x={214}
        y={6}
        width={200}
        height={196}
        rx={8}
        className="fill-brand-50/80 stroke-brand-400"
        strokeWidth={1.25}
        strokeDasharray="4 3"
      />
      <Label x={314} y={26} size={9.5} weight={600} anchor="middle" tone="accent">
        Open Brand Side by Side
      </Label>
      <PaneLogo x={272} y={64} />
      <rect x={292} y={172} width={104} height={18} rx={9} className="fill-brand-600" />
      <Label x={344} y={181.5} size={9} weight={600} anchor="middle" tone="onAccent">
        Release to Open
      </Label>
      <BottomBar y={212} w={420} tabs={['App Screens']} />
      {/* The Brand tab, lifted off the bar and carried up to the right. */}
      <g>
        <rect
          x={222}
          y={172}
          width={52}
          height={18}
          rx={5}
          className="fill-white stroke-slate-300"
          strokeWidth={HAIR}
        />
        <Label x={232} y={181.5} size={9} weight={600} className="fill-brand-600">
          Brand
        </Label>
        <Cursor x={262} y={180} />
      </g>
      <path
        d="M110 222 Q180 214 222 186"
        fill="none"
        className="stroke-slate-300"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </Scene>
  );
}

/** Both tabs open side by side: two panes over one bar, the right pane's tab outlined, and the pane you are editing
 *  holding the toolbars. */
export function SideBySideOpen() {
  return (
    <Scene w={420} h={236}>
      <DesignPage x={60} y={40} w={84} h={150} size="iPhone · Wireframe" bare>
        <PhoneScreen x={66} y={46} w={72} h={138} variant="home" cta="Shop" frame={false} />
      </DesignPage>
      <line x1={210} y1={0} x2={210} y2={212} className="stroke-slate-300" strokeWidth={HAIR} />
      <rect
        x={206}
        y={96}
        width={8}
        height={26}
        rx={4}
        className="fill-white stroke-slate-300"
        strokeWidth={HAIR}
      />
      <PaneLogo x={268} y={64} />
      <BottomBar y={212} w={420} tabs={['App Screens', 'Brand']} />
      <path
        d="M94 236 V221 a5 5 0 0 1 5 -5 H128 a5 5 0 0 1 5 5 V236"
        fill="none"
        className="stroke-brand-400"
        strokeWidth={1.2}
        strokeDasharray="3 2"
      />
    </Scene>
  );
}
