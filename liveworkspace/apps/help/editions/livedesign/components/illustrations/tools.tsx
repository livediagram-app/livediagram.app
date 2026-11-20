// Tools scenes for livedesign (liveworkspace/docs/specs/017-help/help-centre.md): zen mode before and after, the
// appearance switch on the bottom bar, and the layout tidiers (Cleanup, Auto-Align, Auto Layout) on livedesign's own
// pages. Built from the chrome kit (./editor-chrome) and the page content (./design-content).

import { Arrow, Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { BottomBar, Card, DesignPage, EditorFrame } from './editor-chrome';
import { Glyph } from './editor-glyphs';
import { PhoneScreen } from './design-content';
import { APP_PAGES, AppScreens } from './user-interface';

// --- Zen mode ---------------------------------------------------------------

/** Outside zen mode: the Pages rail, the strip, the account card, the corner controls and the bottom bar frame the
 *  canvas. */
export function ZenBefore() {
  return (
    <Scene w={640} h={400}>
      <EditorFrame w={640} h={400} pages={APP_PAGES} level="60%" tabs={['App Screens', 'Brand']}>
        <AppScreens x={168} y={84} />
      </EditorFrame>
    </Scene>
  );
}

/** Zen mode on: only the pages and a lone zoom card whose last button leaves zen. */
export function ZenAfter() {
  const x = 492;
  const y = 364;
  return (
    <Scene w={640} h={400}>
      <AppScreens x={168} y={84} />
      <Card x={x} y={y} w={140} h={22} r={6} />
      <path
        d={`M${x + 10} ${y + 11} h6`}
        className="stroke-slate-600"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Label x={x + 44} y={y + 11.5} size={9} weight={500} anchor="middle" tone="strong">
        60%
      </Label>
      <path
        d={`M${x + 72} ${y + 11} h6 M${x + 75} ${y + 8} v6`}
        className="stroke-slate-600"
        strokeWidth={1}
        strokeLinecap="round"
      />
      <line
        x1={x + 90}
        y1={y + 4}
        x2={x + 90}
        y2={y + 18}
        className="stroke-slate-200"
        strokeWidth={0.75}
      />
      <rect x={x + 94} y={y + 3} width={42} height={16} rx={4} className="fill-brand-50" />
      <path
        d={`M${x + 101} ${y + 8} h3 v-3 M${x + 109} ${y + 5} v3 h3 M${x + 112} ${y + 14} h-3 v3 M${x + 104} ${y + 17} v-3 h-3`}
        className="stroke-brand-600"
        strokeWidth={1}
        fill="none"
        strokeLinecap="round"
      />
      <Label x={x + 117} y={y + 11.5} size={9} weight={600} className="fill-brand-600">
        Exit
      </Label>
    </Scene>
  );
}

// --- Light / dark mode ------------------------------------------------------

function Step({
  x,
  y,
  label,
  icon,
  on = false,
}: {
  x: number;
  y: number;
  label: string;
  icon: 'sun' | 'moon' | 'monitor';
  on?: boolean;
}) {
  return (
    <g>
      <Card x={x} y={y} w={74} h={24} r={6} />
      {on && (
        <rect
          x={x}
          y={y}
          width={74}
          height={24}
          rx={6}
          className="fill-brand-50 stroke-brand-300"
          strokeWidth={0.75}
        />
      )}
      <g transform={`translate(${x + 14} ${y + 12})`}>
        {icon === 'sun' && (
          <>
            <circle r={3} className="fill-none stroke-slate-600" strokeWidth={1} />
            <path
              d="M0 -6 v1.6 M0 6 v-1.6 M-6 0 h1.6 M6 0 h-1.6 M-4.2 -4.2 l1.1 1.1 M4.2 4.2 l-1.1 -1.1 M4.2 -4.2 l-1.1 1.1 M-4.2 4.2 l1.1 -1.1"
              className="stroke-slate-600"
              strokeWidth={1}
              strokeLinecap="round"
            />
          </>
        )}
        {icon === 'moon' && (
          <path
            d="M2 -5 a5 5 0 1 0 3 8 a5.5 5.5 0 0 1 -3 -8 Z"
            className="fill-none stroke-slate-600"
            strokeWidth={1}
            strokeLinejoin="round"
          />
        )}
        {icon === 'monitor' && <Glyph name="monitor" x={0} y={0} />}
      </g>
      <Label x={x + 26} y={y + 12.5} size={9.5} weight={500} tone="strong">
        {label}
      </Label>
    </g>
  );
}

/** The appearance switch, last on the bottom bar, and the Light, Dark, System cycle each click steps through. */
export function LightDarkToggle() {
  return (
    <Scene w={420} h={170}>
      <Step x={60} y={34} label="Light" icon="sun" on />
      <Arrow from={[138, 46]} to={[168, 46]} tone="muted" width={1} />
      <Step x={173} y={34} label="Dark" icon="moon" />
      <Arrow from={[251, 46]} to={[281, 46]} tone="muted" width={1} />
      <Step x={286} y={34} label="System" icon="monitor" />
      <path
        d="M323 62 V76 H97 V64"
        fill="none"
        className="stroke-slate-300"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <path d="M94 66 L97 61 L100 66 Z" className="fill-slate-300" />
      <Label x={210} y={92} size={9.5} tone="muted" anchor="middle">
        Each click moves to the next setting
      </Label>
      <BottomBar y={146} w={420} tabs={['Tab 1']} />
      <circle cx={406} cy={160} r={9} fill="none" className="stroke-brand-500" strokeWidth={1.25} />
    </Scene>
  );
}

// --- Layout cleanup ---------------------------------------------------------

/** A page's blocks, as Cleanup sees them: (x, y, w, h, tone). */
type Block = [number, number, number, number, 'image' | 'text' | 'button'];

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <g>
      {blocks.map(([x, y, w, h, t], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={t === 'button' ? h / 2 : 3}
          className={
            t === 'image' ? 'fill-brand-100' : t === 'button' ? 'fill-brand-500' : 'fill-slate-200'
          }
        />
      ))}
    </g>
  );
}

/** Cleanup: a page of scattered, misaligned blocks, and the same blocks snapped into tidy rows and columns. */
export function CleanupBeforeAfter() {
  return (
    <Scene w={420} h={220}>
      <DesignPage x={24} y={34} w={170} h={166} size="Before" bare>
        <Blocks
          blocks={[
            [38, 48, 62, 44, 'image'],
            [112, 56, 66, 40, 'image'],
            [44, 104, 70, 6, 'text'],
            [118, 112, 54, 6, 'text'],
            [34, 128, 60, 40, 'image'],
            [110, 136, 70, 36, 'image'],
            [52, 180, 44, 12, 'button'],
          ]}
        />
      </DesignPage>
      <Arrow from={[200, 117]} to={[220, 117]} tone="muted" width={1} />
      <DesignPage x={226} y={34} w={170} h={166} size="After" bare>
        <Blocks
          blocks={[
            [240, 48, 66, 42, 'image'],
            [316, 48, 66, 42, 'image'],
            [240, 98, 66, 6, 'text'],
            [316, 98, 66, 6, 'text'],
            [240, 114, 66, 42, 'image'],
            [316, 114, 66, 42, 'image'],
            [240, 168, 44, 12, 'button'],
          ]}
        />
      </DesignPage>
    </Scene>
  );
}

/** Auto-Align: blocks a few pixels off the grid snapping onto its lines. */
export function AutoAlignGrid() {
  return (
    <Scene w={420} h={210}>
      <DesignPage x={80} y={30} w={260} h={164} size="Desktop · Wireframe" bare>
        {[120, 160, 200, 240, 280].map((gx) => (
          <line
            key={gx}
            x1={gx}
            y1={30}
            x2={gx}
            y2={194}
            className="stroke-brand-200"
            strokeWidth={0.5}
          />
        ))}
        {[70, 110, 150].map((gy) => (
          <line
            key={gy}
            x1={80}
            y1={gy}
            x2={340}
            y2={gy}
            className="stroke-brand-200"
            strokeWidth={0.5}
          />
        ))}
        <rect
          x={124}
          y={74}
          width={80}
          height={36}
          rx={3}
          fill="none"
          className="stroke-slate-300"
          strokeWidth={0.75}
          strokeDasharray="3 2"
        />
        <rect
          x={203}
          y={114}
          width={77}
          height={36}
          rx={3}
          fill="none"
          className="stroke-slate-300"
          strokeWidth={0.75}
          strokeDasharray="3 2"
        />
        <rect
          x={120}
          y={70}
          width={80}
          height={40}
          rx={3}
          className="fill-brand-100 stroke-brand-500"
          strokeWidth={1}
        />
        <rect
          x={200}
          y={110}
          width={80}
          height={40}
          rx={3}
          className="fill-slate-100 stroke-brand-500"
          strokeWidth={1}
        />
        <rect x={208} y={120} width={44} height={5} rx={2.5} className="fill-slate-300" />
      </DesignPage>
    </Scene>
  );
}

/** Auto Layout: tangled screens of a prototype flow laid out into clean, ordered columns. */
export function AutoLayoutTidy() {
  const screen = (x: number, y: number, v: 'home' | 'product' | 'checkout', faded = false) => (
    <g opacity={faded ? 0.85 : 1}>
      <DesignPage x={x} y={y} w={40} h={76} size="" bare>
        <PhoneScreen x={x + 3} y={y + 3} w={34} h={70} variant={v} cta="" frame={false} />
      </DesignPage>
    </g>
  );
  return (
    <Scene w={420} h={200}>
      {screen(30, 100, 'checkout', true)}
      {screen(100, 30, 'home', true)}
      {screen(130, 112, 'product', true)}
      <Arrow from={[140, 66]} to={[150, 112]} tone="muted" width={1} />
      <Arrow from={[130, 160]} to={[72, 150]} tone="muted" width={1} />
      <g transform="translate(196 92)">
        <rect x={0} y={-11} width={26} height={22} rx={6} className="fill-brand-500" />
        <path
          d="M7 0 h12 M14 -4.5 l5 4.5 l-5 4.5"
          className="stroke-white help-art-as-drawn"
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <Label x={209} y={70} size={9} weight={600} anchor="middle" tone="accent">
        Auto Layout
      </Label>
      {screen(248, 60, 'home')}
      {screen(306, 60, 'product')}
      {screen(364, 60, 'checkout')}
      <Arrow from={[288, 98]} to={[306, 98]} width={1.25} />
      <Arrow from={[346, 98]} to={[364, 98]} width={1.25} />
    </Scene>
  );
}
