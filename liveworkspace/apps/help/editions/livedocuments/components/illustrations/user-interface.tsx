// User-Interface-category illustrations (liveworkspace/docs/specs/017-help/help-centre.md), on livedocuments' own
// chrome: the bottom bar with its tabs and quick controls, the bottom-right corner cluster and its zoom presets, the
// whole frame at a glance, the top of a shared document, and an element's menu. Labels are the editor's own
// (apps/editor: TabBar, ChromeControls, ZoomMenu, EditorContextMenu); the chrome is ./editor-chrome's and the pages
// ./doc-page's.

import { lucideChevronDown, lucideChevronRight } from '@liveworkspace/icons/lucide';
import {
  Label,
  Lift,
  Panel,
  Scene,
  SelectionBox,
  Shape,
} from '@liveworkspace/help-site/art/primitives';
import {
  BAR_H,
  BottomBar,
  CLUSTER_W,
  CORNER_W,
  CornerCard,
  CornerCluster,
  Icon,
  LOGO_W,
  MenuButtonCard,
  LogoCard,
  STRIP_W,
  Strip,
  TopRow,
} from './editor-chrome';
import { Heading, Lines, Page, Rule, Sheet, SlideContent } from './doc-page';

// --- The bottom bar ----------------------------------------------------------

/** The bottom bar: the open tab, the others, the + button, then the quick controls at its right-hand end. */
export function TabBar() {
  const W = 420;
  return (
    <Scene w={W} h={150}>
      <Page x={110} y={26} w={200} h={88} name="Cover">
        <SlideContent x={110} y={26} w={200} h={88} title="Pitch Deck" layout="title" />
      </Page>
      <BottomBar y={150 - BAR_H} w={W} tabs={['Pitch Deck', 'Brief', 'Poster']} />
    </Scene>
  );
}

/** The quick controls at the bottom bar's right-hand end, outlined: Tools, Settings, notifications and the
 *  appearance switch. */
export function QuickControls() {
  const W = 420;
  return (
    <Scene w={W} h={150}>
      <Page x={110} y={26} w={200} h={88} name="Cover">
        <SlideContent x={110} y={26} w={200} h={88} title="Pitch Deck" layout="title" />
      </Page>
      <BottomBar y={150 - BAR_H} w={W} tabs={['Pitch Deck', 'Brief']} />
      <rect
        x={W - 142}
        y={150 - BAR_H + 4}
        width={138}
        height={20}
        rx={6}
        fill="none"
        className="stroke-brand-500"
        strokeWidth={1.25}
        strokeDasharray="4 3"
      />
    </Scene>
  );
}

// --- The whole frame ---------------------------------------------------------

/** The whole frame at a glance: the logo and menu cards top-left, the palette strip across the top, Share and Sign
 *  In top-right, Contents down the left listing the deck's slides, the slide being edited, the corner cluster
 *  bottom-right and the bottom bar. */
export function PanelLayout() {
  const W = 470;
  const H = 280;
  const slides = ['Cover', 'Results', 'Next Steps'];
  return (
    <Scene w={W} h={H}>
      <TopRow w={W} />
      <Panel x={8} y={44} w={96} h={174} title="Contents">
        {slides.map((name, i) => {
          const y = 74 + i * 46;
          const on = i === 1;
          return (
            <g key={name}>
              {on && (
                <rect x={14} y={y - 4} width={84} height={44} rx={5} className="fill-brand-50" />
              )}
              <Label x={20} y={y + 14} size={9} tone="muted" anchor="middle">
                {String(i + 1)}
              </Label>
              <rect
                x={28}
                y={y}
                width={52}
                height={29}
                rx={1.5}
                className={on ? 'fill-white stroke-brand-500' : 'fill-white stroke-slate-200'}
                strokeWidth={on ? 1.25 : 0.75}
              />
              <rect x={32} y={y + 5} width={22} height={3} rx={1} className="fill-slate-400" />
              <rect x={32} y={y + 11} width={16} height={2} rx={1} className="fill-slate-200" />
              <Label
                x={28}
                y={y + 36}
                size={9}
                tone={on ? 'accent' : 'body'}
                weight={on ? 600 : 400}
              >
                {name}
              </Label>
            </g>
          );
        })}
      </Panel>
      <Page x={140} y={78} w={226} h={127} name="Results">
        <SlideContent x={140} y={78} w={226} h={127} title="Q3 Results" />
      </Page>
      <CornerCluster x={W - 8 - CLUSTER_W} y={H - BAR_H - 32} level="72%" />
      <BottomBar y={H - BAR_H} w={W} tabs={['Pitch Deck', 'Brief']} />
    </Scene>
  );
}

/** The bottom-right cluster with the zoom presets open above the level: 25% to 150%, then Fit to Screen. */
export function ZoomControls() {
  const presets = ['25%', '50%', '75%', '100%', '125%', '150%'];
  const W = 420;
  const cx = W - 8 - CLUSTER_W;
  const px = cx + 53;
  const pw = 80;
  const py = 26;
  return (
    <Scene w={W} h={230}>
      <Page x={24} y={60} w={196} h={110} name="Cover">
        <SlideContent x={24} y={60} w={196} h={110} title="Field Guide" layout="picture" />
      </Page>
      <Lift x={px} y={py} w={pw} h={160} r={7} />
      <rect
        x={px}
        y={py}
        width={pw}
        height={160}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      {presets.map((p, i) => {
        const ry = py + 5 + i * 20;
        const on = p === '100%';
        return (
          <g key={p}>
            {on && (
              <rect x={px + 4} y={ry} width={pw - 8} height={18} rx={4} className="fill-brand-50" />
            )}
            <Label
              x={px + pw / 2}
              y={ry + 9.5}
              size={9.5}
              weight={on ? 650 : 500}
              tone={on ? 'accent' : 'body'}
              anchor="middle"
            >
              {p}
            </Label>
          </g>
        );
      })}
      <line
        x1={px + 6}
        y1={py + 130}
        x2={px + pw - 6}
        y2={py + 130}
        className="stroke-slate-100"
        strokeWidth={0.75}
      />
      <Label x={px + pw / 2} y={py + 145} size={9.5} weight={500} tone="body" anchor="middle">
        Fit to Screen
      </Label>
      <CornerCluster x={cx} y={196} highlight="zoom" />
    </Scene>
  );
}

/** The Map: a zoomed-out outline of the tab's pages, the part outside your view dimmed and a brand box marking what
 *  you see. */
export function Minimap() {
  return (
    <Scene w={420} h={210}>
      <Page x={196} y={34} w={196} h={110} name="Results">
        <SlideContent x={196} y={34} w={196} h={110} title="Q3 Results" />
      </Page>
      <Panel x={20} y={100} w={146} h={96} title="Map">
        <rect x={26} y={128} width={134} height={62} rx={4} className="fill-slate-100" />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={34 + i * 42}
            y={146}
            width={36}
            height={20}
            rx={1}
            className="fill-white stroke-slate-300"
            strokeWidth={0.5}
          />
        ))}
        <rect
          x={74}
          y={140}
          width={46}
          height={32}
          rx={2}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.25}
        />
      </Panel>
    </Scene>
  );
}

// --- The top of the editor ---------------------------------------------------

/** The top of a shared document as its owner sees it: the logo card, the menu card, the palette strip, and the
 *  corner card with Share and the account, each named under it. */
export function TitleBarParts() {
  const W = 482;
  const parts: [string, number][] = [
    ['Logo', 8 + LOGO_W / 2],
    ['Menu', 8 + LOGO_W + 6 + 14],
    ['Palette', 0],
    ['Share', W - 8 - CORNER_W + 14],
    ['Account', W - 8 - CORNER_W + 40],
  ];
  const stripX = 8 + LOGO_W + 6 + 28 + 8;
  parts[2]![1] = stripX + STRIP_W / 2;
  return (
    <Scene w={W} h={96}>
      <LogoCard x={8} y={16} />
      <MenuButtonCard x={8 + LOGO_W + 6} y={16} />
      <Strip x={stripX} y={16} />
      <CornerCard x={W - 8 - CORNER_W} y={16} initial="A" />
      {parts.map(([name, x], i) => {
        const low = i % 2 === 1;
        return (
          <g key={name}>
            <line
              x1={x}
              y1={46}
              x2={x}
              y2={low ? 74 : 58}
              className="stroke-slate-300"
              strokeWidth={0.75}
            />
            <circle cx={x} cy={46} r={1.5} className="fill-slate-400" />
            <Label x={x} y={low ? 82 : 66} size={9.5} weight={500} tone="body" anchor="middle">
              {name}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}

// --- The element menu --------------------------------------------------------

/** Right-clicking a shape on a slide opens its menu: collapsible sections for its layer, size, shape and rotation,
 *  then Appearance, Text and Animation opening beside it, and its Link. */
export function ElementContextMenu() {
  const sections: [string, 'down' | 'side'][] = [
    ['Layer', 'down'],
    ['Size', 'down'],
    ['Shape', 'down'],
    ['Rotation', 'down'],
    ['Appearance', 'side'],
    ['Text', 'side'],
    ['Animation', 'side'],
    ['Link', 'down'],
  ];
  const mx = 236;
  const my = 18;
  const mw = 136;
  const rowH = 20;
  const mh = sections.length * rowH + 8;
  return (
    <Scene w={420} h={200}>
      <Sheet x={28} y={44} w={196} h={128}>
        <Heading x={42} y={62} size={11}>
          Our Promise
        </Heading>
        <Rule x={42} y={71} />
        <Lines x={42} y={84} w={70} n={3} />
      </Sheet>
      <Shape x={128} y={92} w={80} h={48} accent label="Quality" labelTone="onAccent" />
      <SelectionBox x={128} y={92} w={80} h={48} />
      <Lift x={mx} y={my} w={mw} h={mh} r={7} />
      <rect
        x={mx}
        y={my}
        width={mw}
        height={mh}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={0.75}
      />
      {sections.map(([name, opens], i) => {
        const ry = my + 4 + i * rowH;
        const on = name === 'Appearance';
        return (
          <g key={name}>
            {on && (
              <rect
                x={mx + 4}
                y={ry}
                width={mw - 8}
                height={rowH}
                rx={4}
                className="fill-brand-50"
              />
            )}
            <Label
              x={mx + 12}
              y={ry + rowH / 2 + 0.5}
              size={9.5}
              weight={on ? 600 : 500}
              tone={on ? 'accent' : 'body'}
            >
              {name}
            </Label>
            <Icon
              prims={opens === 'side' ? lucideChevronRight : lucideChevronDown}
              x={mx + mw - 14}
              y={ry + rowH / 2}
              size={8}
              className={on ? 'stroke-brand-700' : 'stroke-slate-400'}
            />
          </g>
        );
      })}
    </Scene>
  );
}
