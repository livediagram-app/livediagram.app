// Tools-category illustrations (liveworkspace/docs/specs/017-help/help-centre.md): zen mode before and after, the
// appearance switch's Light, Dark and System cycle, and the two layout tidiers (Auto-Align, Auto Layout), on
// livedocuments' own chrome (./editor-chrome) and pages (./doc-page).

import { lucideMinimize2, lucideSun } from '@liveworkspace/icons/lucide';
import { Arrow, Label, Scene, Shape } from '@liveworkspace/help-site/art/primitives';
import {
  BAR_H,
  BottomBar,
  Card,
  CLUSTER_W,
  CornerCluster,
  Icon,
  ICONS,
  TopRow,
} from './editor-chrome';
import { Heading, Page, SlideContent } from './doc-page';

// --- Zen mode ---------------------------------------------------------------

/** The editor with all its chrome over the canvas, before zen mode: the logo and menu cards, the palette strip, the
 *  corner card, the corner cluster and the bottom bar. */
export function ZenBefore() {
  const W = 470;
  const H = 260;
  return (
    <Scene w={W} h={H}>
      <TopRow w={W} />
      <Page x={110} y={68} w={250} h={141} name="Cover">
        <SlideContent x={110} y={68} w={250} h={141} title="Field Guide" layout="picture" />
      </Page>
      <CornerCluster x={W - 8 - CLUSTER_W} y={H - BAR_H - 32} />
      <BottomBar y={H - BAR_H} w={W} tabs={['Pitch Deck', 'Brief']} />
    </Scene>
  );
}

/** Zen mode on: every panel gone, the slide alone on the canvas, and the zoom card with the button that leaves zen
 *  in the corner. */
export function ZenAfter() {
  const W = 470;
  const H = 260;
  const zx = W - 8 - 104;
  return (
    <Scene w={W} h={H}>
      <Page x={110} y={52} w={250} h={141} bare>
        <SlideContent x={110} y={52} w={250} h={141} title="Field Guide" layout="picture" />
      </Page>
      <Card x={zx} y={H - 32} w={104} h={24}>
        <Icon prims={[{ t: 'path', d: 'M5 12h14' }]} x={zx + 12} y={H - 20} size={8} />
        <Label x={zx + 38} y={H - 19.5} size={9} weight={500} tone="strong" anchor="middle">
          100%
        </Label>
        <Icon prims={[{ t: 'path', d: 'M5 12h14M12 5v14' }]} x={zx + 64} y={H - 20} size={8} />
        <line
          x1={zx + 78}
          y1={H - 28}
          x2={zx + 78}
          y2={H - 12}
          className="stroke-slate-200"
          strokeWidth={0.75}
        />
        <rect x={zx + 81} y={H - 29} width={20} height={18} rx={4} className="fill-brand-50" />
        <Icon
          prims={lucideMinimize2}
          x={zx + 91}
          y={H - 20}
          size={8}
          className="stroke-brand-700"
        />
      </Card>
    </Scene>
  );
}

// --- Light and dark ---------------------------------------------------------

// Lucide's moon, in its 24-unit box.
const MOON = [{ t: 'path', d: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' }] as const;

/** One stop on the appearance cycle: its glyph and name on a small card, `on` while it is the setting in force. */
function Stop({
  x,
  y,
  w,
  label,
  prims,
  on = false,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  prims: Parameters<typeof Icon>[0]['prims'];
  on?: boolean;
}) {
  return (
    <Card x={x} y={y} w={w} h={24}>
      {on && (
        <rect x={x + 2} y={y + 2} width={w - 4} height={20} rx={4} className="fill-brand-50" />
      )}
      <Icon
        prims={prims}
        x={x + 13}
        y={y + 12}
        size={9}
        className={on ? 'stroke-brand-700' : 'stroke-slate-600'}
      />
      <Label
        x={x + 23}
        y={y + 12.5}
        size={9.5}
        weight={on ? 600 : 500}
        tone={on ? 'accent' : 'body'}
      >
        {label}
      </Label>
    </Card>
  );
}

/** The appearance switch at the bottom bar's right-hand end, after Tools, Settings and the notifications bell, and the
 *  Light, Dark, System cycle each click steps through. */
export function LightDarkToggle() {
  const W = 420;
  const H = 170;
  return (
    <Scene w={W} h={H}>
      <Stop x={70} y={34} w={64} label="Light" prims={lucideSun} on />
      <Arrow from={[140, 46]} to={[166, 46]} tone="muted" />
      <Stop x={172} y={34} w={62} label="Dark" prims={MOON} />
      <Arrow from={[240, 46]} to={[266, 46]} tone="muted" />
      <Stop x={272} y={34} w={74} label="System" prims={ICONS.monitor} />
      <path
        d="M309 64 V80 H102 V66"
        fill="none"
        className="stroke-slate-300"
        strokeWidth={1.25}
        strokeDasharray="3 3"
        strokeLinecap="round"
      />
      <path d="M98 68 L102 62 L106 68 Z" className="fill-slate-300" />
      <Label x={206} y={92} size={9.5} tone="muted" anchor="middle">
        Each click moves to the next setting
      </Label>
      <BottomBar y={H - BAR_H} w={W} tabs={['Pitch Deck']} />
      <circle
        cx={W - 13}
        cy={H - BAR_H + 15}
        r={8}
        className="fill-none stroke-brand-500"
        strokeWidth={1.25}
      />
    </Scene>
  );
}

// --- Layout cleanup ---------------------------------------------------------

/** Auto-Align: the cards on an infographic page, each a few pixels off the grid, snap onto it (the whole tab, no
 *  selection). */
export function AutoAlignGrid() {
  return (
    <Scene w={420} h={220}>
      <Page x={50} y={34} w={320} h={172} name="Highlights" rest="A4">
        <Heading x={68} y={54} size={11}>
          Highlights
        </Heading>
        {[110, 190, 270].map((gx) => (
          <line
            key={`v${gx}`}
            x1={gx}
            y1={68}
            x2={gx}
            y2={196}
            className="stroke-slate-200"
            strokeWidth={0.75}
          />
        ))}
        {[80, 140].map((gy) => (
          <line
            key={`h${gy}`}
            x1={60}
            y1={gy}
            x2={360}
            y2={gy}
            className="stroke-slate-200"
            strokeWidth={0.75}
          />
        ))}
        <Shape x={116} y={85} w={70} h={44} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
        <Shape
          x={193}
          y={136}
          w={70}
          h={44}
          dashed
          fill="fill-slate-50"
          stroke="stroke-slate-300"
        />
        <Shape x={110} y={80} w={70} h={44} accent label="Reach" labelTone="onAccent" />
        <Shape x={190} y={140} w={70} h={44} accent label="Growth" labelTone="onAccent" />
      </Page>
    </Scene>
  );
}

/** Auto Layout on an infographic: a tangle of steps joined by arrows, relaid into clean left-to-right layers. */
export function AutoLayoutTidy() {
  return (
    <Scene w={420} h={220}>
      <Page x={12} y={34} w={396} h={174} name="Our Process" rest="A4">
        <Shape x={28} y={60} w={50} h={28} label="Idea" />
        <Shape x={118} y={110} w={50} h={28} label="Draft" />
        <Shape x={36} y={160} w={50} h={28} label="Ship" />
        <Shape x={132} y={52} w={50} h={28} label="Test" />
        <Arrow from={[78, 72]} to={[132, 66]} tone="muted" />
        <Arrow from={[64, 88]} to={[126, 110]} tone="muted" />
        <Arrow from={[124, 138]} to={[80, 160]} tone="muted" />
        <g transform="translate(194 124)">
          <rect x={0} y={-11} width={26} height={22} rx={6} className="fill-brand-500" />
          <path
            d="M7 0 h12 M14 -5 l5 5 l-5 5"
            className="stroke-white"
            strokeWidth={1.75}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <Label x={207} y={102} size={9} weight={650} anchor="middle" tone="accent">
          Auto Layout
        </Label>
        <Shape x={236} y={116} w={44} h={28} label="Idea" />
        <Shape x={298} y={74} w={44} h={28} label="Test" />
        <Shape x={298} y={158} w={44} h={28} accent label="Draft" labelTone="onAccent" />
        <Shape x={356} y={158} w={44} h={28} label="Ship" />
        <Arrow from={[280, 130]} to={[298, 88]} kind="elbow" />
        <Arrow from={[280, 130]} to={[298, 172]} kind="elbow" />
        <Arrow from={[342, 172]} to={[356, 172]} />
      </Page>
    </Scene>
  );
}
