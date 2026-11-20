// User Interface scenes for livedesign (liveworkspace/docs/specs/017-help/help-centre.md): the whole editor at a
// glance, the top row's parts, the bottom bar and its quick controls, and the zoom presets. Drawn from the chrome
// kit (./editor-chrome), which follows apps/live: the Pages rail, ToolbarPalette, ChromeControls and TabBar.

import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import {
  AccountCard,
  BottomBar,
  Card,
  CornerControls,
  DesignPage,
  EditorFrame,
  PagesRail,
  RAIL_W,
  STRIP_W,
  Strip,
} from './editor-chrome';
import { BrowserScreen, LogoMark, PhoneScreen, phoneThumb } from './design-content';

export const APP_PAGES = [
  { name: 'Home', thumb: phoneThumb('home') },
  { name: 'Product', thumb: phoneThumb('product') },
  { name: 'Checkout', thumb: phoneThumb('checkout') },
];

/** Three phone screens on the canvas, as a tab of wireframe pages lays them out, the first at (x, y). */
export function AppScreens({
  x,
  y,
  h = 250,
  gap = 28,
}: {
  x: number;
  y: number;
  h?: number;
  gap?: number;
}) {
  const w = Math.round(h * 0.48);
  const kinds = [
    ['home', 'Shop Now'],
    ['product', 'Add to Cart'],
    ['checkout', 'Pay'],
  ] as const;
  return (
    <g>
      {kinds.map(([v, cta], i) => (
        <DesignPage
          key={v}
          x={x + i * (w + gap)}
          y={y}
          w={w}
          h={h}
          size={i === 0 ? 'iPhone · Wireframe' : ''}
          bare
        >
          <PhoneScreen
            x={x + i * (w + gap) + 7}
            y={y + 7}
            w={w - 14}
            h={h - 14}
            variant={v}
            cta={cta}
            frame={false}
          />
        </DesignPage>
      ))}
    </g>
  );
}

/** The whole editor: the Pages rail with its thumbnails, the palette strip, the account card, a tab's pages on the
 *  canvas, the corner controls and the bottom bar. */
export function PanelLayout() {
  return (
    <Scene w={640} h={400}>
      <EditorFrame w={640} h={400} pages={APP_PAGES} level="60%" tabs={['App Screens', 'Brand']}>
        <AppScreens x={168} y={84} />
      </EditorFrame>
    </Scene>
  );
}

/** A dashed outline picking out part of the chrome. */
function Pick({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={6}
      fill="none"
      className="stroke-brand-500"
      strokeWidth={1.25}
      strokeDasharray="4 3"
    />
  );
}

/** The bottom bar's right-hand end, picked out: Tools, Settings, notifications and the appearance switch. */
export function QuickControls() {
  return (
    <Scene w={420} h={130}>
      <DesignPage x={130} y={30} w={160} h={66} size="A4 · Landscape" bare>
        <BrowserScreen x={138} y={36} w={144} h={54} />
      </DesignPage>
      <BottomBar y={106} w={420} tabs={['Tab 1']} />
      <Pick x={262} y={109} w={154} h={19} />
    </Scene>
  );
}

/** The bottom bar: the open tab raised with its ⋯, the other tabs, +, then the quick controls. */
export function TabBar() {
  return (
    <Scene w={420} h={150}>
      <DesignPage x={60} y={30} w={84} h={84} size="Logo · Square" bare>
        <LogoMark cx={102} cy={66} r={18} />
      </DesignPage>
      <DesignPage x={170} y={30} w={84} h={84} size="Logo · Square" bare>
        <rect x={170} y={30} width={84} height={84} className="fill-slate-800" />
        <LogoMark cx={212} cy={66} r={18} word={false} />
      </DesignPage>
      <BottomBar y={126} w={420} tabs={['Brand', 'App Screens', 'Web']} />
    </Scene>
  );
}

/** The zoom card in the corner with its presets open above it. */
export function ZoomControls() {
  const presets = ['25%', '50%', '75%', '100%', '125%', '150%'];
  const x = 326;
  return (
    <Scene w={420} h={236}>
      <DesignPage x={60} y={50} w={120} h={160} size="A4 · Portrait" bare>
        <rect x={72} y={64} width={96} height={44} rx={3} className="fill-brand-100" />
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={72}
            y={118 + i * 10}
            width={i === 3 ? 50 : 96}
            height={4}
            rx={2}
            className="fill-slate-200"
          />
        ))}
      </DesignPage>
      <Card x={x} y={34} w={80} h={166} r={8} />
      {presets.map((p, i) => {
        const on = p === '100%';
        return (
          <g key={p}>
            {on && (
              <rect
                x={x + 4}
                y={40 + i * 20}
                width={72}
                height={18}
                rx={4}
                className="fill-brand-50"
              />
            )}
            <Label
              x={x + 40}
              y={49.5 + i * 20}
              size={9}
              weight={on ? 600 : 400}
              anchor="middle"
              className={on ? 'fill-brand-600' : 'fill-slate-600'}
            >
              {p}
            </Label>
          </g>
        );
      })}
      <line
        x1={x + 6}
        y1={163}
        x2={x + 74}
        y2={163}
        className="stroke-slate-200"
        strokeWidth={0.75}
      />
      <Label x={x + 40} y={181} size={9} anchor="middle" tone="body">
        Fit to Screen
      </Label>
      <CornerControls right={412} y={208} level="100%" />
    </Scene>
  );
}

/** A label under a part of the top row, joined to it by a short leader. */
function Callout({ x, y, top, children }: { x: number; y: number; top: number; children: string }) {
  return (
    <g>
      <path
        d={`M${x} ${top} V${y - 8}`}
        className="stroke-slate-300"
        strokeWidth={0.75}
        strokeDasharray="2 2"
      />
      <circle cx={x} cy={top} r={1.6} className="fill-slate-400" />
      <Label x={x} y={y} size={9.5} weight={600} anchor="middle" tone="body">
        {children}
      </Label>
    </g>
  );
}

/** The top of the editor, named: the logo and menu at the top of the Pages rail, the palette strip, and the share
 *  and sign-in card. */
export function TitleBarParts() {
  const w = RAIL_W + 11 + STRIP_W + 64;
  return (
    <Scene w={w} h={110}>
      <PagesRail h={110} pages={[]} foot={false} />
      <Strip x={RAIL_W + 11} y={8} />
      <AccountCard right={w - 6} y={8} />
      <Callout x={36} top={30} y={66}>
        Logo
      </Callout>
      <Callout x={100} top={30} y={86}>
        Menu
      </Callout>
      <Callout x={RAIL_W + 11 + STRIP_W / 2} top={36} y={66}>
        Palette
      </Callout>
      <Callout x={w - 42} top={36} y={66}>
        Share
      </Callout>
      <Callout x={w - 19} top={36} y={86}>
        Sign In
      </Callout>
    </Scene>
  );
}
