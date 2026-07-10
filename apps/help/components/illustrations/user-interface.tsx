// User-Interface-category illustrations (spec/55): the floating panels that
// frame the canvas (palette, tab bar, toolbar, zoom controls, quick controls)
// and the right-click context menus. Composed only from the shared primitives
// so the house style holds.

import { Scene, Shape, Arrow, SelectionBox, Panel, Tile, Menu, Label } from './primitives';

// --- Reusable surface pieces -------------------------------------------------

/** The zoom control cluster: minus, current level (click to fit, hover for
 *  the preset popover), plus. Drawn at an absolute (x, y) so scenes can dock
 *  it in a corner. */
function ZoomCluster({ x, y }: { x: number; y: number }) {
  return (
    <Panel x={x} y={y} w={124} h={34}>
      <Label x={x + 20} y={y + 18} size={13} weight={700} tone="muted" anchor="middle">
        −
      </Label>
      <line
        x1={x + 38}
        y1={y + 7}
        x2={x + 38}
        y2={y + 27}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 62} y={y + 18} size={11} weight={600} tone="body" anchor="middle">
        100%
      </Label>
      <line
        x1={x + 86}
        y1={y + 7}
        x2={x + 86}
        y2={y + 27}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 104} y={y + 18} size={13} weight={700} tone="muted" anchor="middle">
        +
      </Label>
    </Panel>
  );
}

/** The zoom-preset popover that opens above the percentage button on hover:
 *  a few preset levels (the current one highlighted) and Fit to screen. */
function ZoomPresetPopover({ x, y }: { x: number; y: number }) {
  return (
    <Panel x={x} y={y} w={76} h={88}>
      <Label x={x + 38} y={y + 16} size={10} weight={500} tone="muted" anchor="middle">
        50%
      </Label>
      <rect
        x={x + 6}
        y={y + 26}
        width={64}
        height={18}
        rx={5}
        className="fill-brand-50 stroke-brand-400"
        strokeWidth={1.5}
      />
      <Label x={x + 38} y={y + 35} size={10} weight={700} tone="accent" anchor="middle">
        100%
      </Label>
      <Label x={x + 38} y={y + 54} size={10} weight={500} tone="muted" anchor="middle">
        150%
      </Label>
      <line
        x1={x + 8}
        y1={y + 64}
        x2={x + 68}
        y2={y + 64}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 38} y={y + 76} size={10} weight={500} tone="body" anchor="middle">
        Fit
      </Label>
    </Panel>
  );
}

/** The corner quick-controls stack: search, settings, help. Drawn vertically
 *  so it reads as the fixed corner cluster. */
function QuickStack({ x, y }: { x: number; y: number }) {
  return (
    <Panel x={x} y={y} w={34} h={108}>
      {/* Search: magnifier */}
      <g transform={`translate(${x + 17} ${y + 18})`}>
        <circle r={5.5} className="stroke-slate-500" strokeWidth={2} fill="none" />
        <path d="M4 4 L8 8" className="stroke-slate-500" strokeWidth={2} strokeLinecap="round" />
      </g>
      <line
        x1={x + 7}
        y1={y + 36}
        x2={x + 27}
        y2={y + 36}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Settings: gear-ish ring */}
      <g transform={`translate(${x + 17} ${y + 54})`}>
        <circle r={4} className="stroke-slate-500" strokeWidth={2} fill="none" />
        <path
          d="M0 -8 v3 M0 8 v-3 M-8 0 h3 M8 0 h-3 M-5.6 -5.6 l2 2 M5.6 5.6 l-2 -2 M5.6 -5.6 l-2 2 M-5.6 5.6 l2 -2"
          className="stroke-slate-500"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
      <line
        x1={x + 7}
        y1={y + 72}
        x2={x + 27}
        y2={y + 72}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />
      {/* Help: question mark */}
      <g transform={`translate(${x + 17} ${y + 90})`}>
        <circle r={8} className="stroke-slate-300" strokeWidth={1.5} fill="none" />
        <Label x={0} y={1} anchor="middle" size={11} weight={700} tone="muted">
          ?
        </Label>
      </g>
    </Panel>
  );
}

// --- Scenes ------------------------------------------------------------------

/** The whole frame at a glance: canvas with floating panels around it (palette
 *  top-right, tab bar bottom, zoom + quick controls in the corners). */
export function PanelLayout() {
  return (
    <Scene w={420} h={250}>
      {/* Canvas content sitting under the chrome */}
      <Shape x={56} y={70} w={80} h={46} label="Start" />
      <Shape x={176} y={104} w={80} h={46} kind="diamond" />
      <Arrow from={[136, 93]} to={[176, 121]} />

      {/* Palette, top-right */}
      <Panel x={300} y={20} w={102} h={100} title="PALETTE">
        <Tile x={306} y={50} active>
          <rect
            x={-7}
            y={-7}
            width={14}
            height={14}
            rx={2}
            className="stroke-white"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={338} y={50}>
          <circle r={7} className="stroke-brand-500" strokeWidth={2} fill="none" />
        </Tile>
        <Tile x={370} y={50}>
          <path
            d="M0 -8 L8 0 L0 8 L-8 0 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={306} y={82}>
          <path
            d="M-8 -6 h16 v12 h-16 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={338} y={82}>
          <path d="M-7 0 h14 M0 -7 v14" className="stroke-brand-500" strokeWidth={2} />
        </Tile>
        <Tile x={370} y={82}>
          <ellipse rx={8} ry={6} className="stroke-brand-500" strokeWidth={2} fill="none" />
        </Tile>
      </Panel>

      {/* Quick controls, top-left */}
      <Panel x={18} y={20} w={34} h={70}>
        <g transform="translate(35 38)">
          <circle r={5.5} className="stroke-slate-500" strokeWidth={2} fill="none" />
          <path d="M4 4 L8 8" className="stroke-slate-500" strokeWidth={2} strokeLinecap="round" />
        </g>
        <line x1={25} y1={56} x2={45} y2={56} className="stroke-slate-200" strokeWidth={1.5} />
        <g transform="translate(35 74)">
          <circle r={4} className="stroke-slate-500" strokeWidth={2} fill="none" />
          <path
            d="M0 -7 v2 M0 7 v-2 M-7 0 h2 M7 0 h-2"
            className="stroke-slate-500"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      </Panel>

      {/* Tab bar, bottom */}
      <Panel x={18} y={208} w={250} h={30}>
        <rect
          x={26}
          y={214}
          width={66}
          height={18}
          rx={6}
          className="fill-brand-50 stroke-brand-300"
          strokeWidth={1.5}
        />
        <Label x={59} y={224} anchor="middle" size={10} weight={600} tone="accent">
          Flow
        </Label>
        <Label x={118} y={224} anchor="middle" size={10} weight={500} tone="muted">
          Notes
        </Label>
        <Label x={176} y={224} anchor="middle" size={10} weight={500} tone="muted">
          Data
        </Label>
        <Label x={244} y={224} anchor="middle" size={13} weight={700} tone="muted">
          +
        </Label>
      </Panel>

      {/* Zoom controls, bottom-right */}
      <Panel x={290} y={208} w={112} h={30}>
        <Label x={306} y={224} size={12} weight={700} tone="muted" anchor="middle">
          −
        </Label>
        <Label x={346} y={224} size={10} weight={600} tone="body" anchor="middle">
          100%
        </Label>
        <Label x={388} y={224} size={12} weight={700} tone="muted" anchor="middle">
          +
        </Label>
      </Panel>
    </Scene>
  );
}

/** A selected shape with its contextual toolbar floating just above it:
 *  style, text, align, group, link, lock, duplicate, delete. */
export function ContextualToolbar() {
  const tiles = ['fill', 'text', 'order', 'link', 'lock', 'dup', 'del'];
  const tx = 70;
  const ty = 130;
  return (
    <Scene w={420} h={230}>
      <Shape x={130} y={120} w={120} h={66} accent label="Process" />
      <SelectionBox x={130} y={120} w={120} h={66} />
      {/* Floating toolbar above the selection */}
      <Panel x={tx} y={ty - 56} w={244} h={38}>
        {tiles.map((kind, i) => {
          const cx = tx + 18 + i * 34;
          const cy = ty - 56 + 19;
          return (
            <g key={kind} transform={`translate(${cx} ${cy})`}>
              {kind === 'fill' && (
                <rect
                  x={-8}
                  y={-8}
                  width={16}
                  height={16}
                  rx={3}
                  className="fill-brand-400 stroke-brand-600"
                  strokeWidth={1.5}
                />
              )}
              {kind === 'text' && (
                <>
                  <path
                    d="M-6 -6 h12 M0 -6 v12"
                    className="stroke-slate-600"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </>
              )}
              {kind === 'order' && (
                <>
                  <rect
                    x={-7}
                    y={-2}
                    width={12}
                    height={9}
                    rx={2}
                    className="fill-white stroke-slate-500"
                    strokeWidth={1.5}
                  />
                  <rect
                    x={-3}
                    y={-7}
                    width={12}
                    height={9}
                    rx={2}
                    className="fill-brand-100 stroke-slate-500"
                    strokeWidth={1.5}
                  />
                </>
              )}
              {kind === 'link' && (
                <path
                  d="M-5 -3 a4 4 0 0 0 0 8 h3 M5 3 a4 4 0 0 0 0 -8 h-3 M-3 1 h6"
                  className="stroke-slate-600"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                />
              )}
              {kind === 'lock' && (
                <>
                  <rect
                    x={-6}
                    y={-1}
                    width={12}
                    height={9}
                    rx={2}
                    className="fill-white stroke-slate-600"
                    strokeWidth={1.5}
                  />
                  <path
                    d="M-3 -1 v-3 a3 3 0 0 1 6 0 v3"
                    className="stroke-slate-600"
                    strokeWidth={1.5}
                    fill="none"
                  />
                </>
              )}
              {kind === 'dup' && (
                <>
                  <rect
                    x={-6}
                    y={-6}
                    width={10}
                    height={10}
                    rx={2}
                    className="fill-white stroke-slate-500"
                    strokeWidth={1.5}
                  />
                  <rect
                    x={-2}
                    y={-2}
                    width={10}
                    height={10}
                    rx={2}
                    className="fill-white stroke-slate-500"
                    strokeWidth={1.5}
                  />
                </>
              )}
              {kind === 'del' && (
                <path
                  d="M-6 -4 h12 M-4 -4 v9 a2 2 0 0 0 2 2 h4 a2 2 0 0 0 2 -2 v-9 M-2 -4 v-2 h4 v2"
                  className="stroke-rose-500"
                  strokeWidth={1.8}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

/** Several elements selected at once with a multi-select toolbar: align,
 *  distribute, group, and bulk delete. */
export function MultiSelectToolbar() {
  const tx = 72;
  const ty = 110;
  return (
    <Scene w={420} h={230}>
      <Shape x={110} y={108} w={66} h={40} />
      <Shape x={208} y={108} w={66} h={40} kind="circle" />
      <Shape x={306} y={108} w={66} h={40} kind="diamond" />
      {/* Group marquee */}
      <rect
        x={100}
        y={98}
        width={282}
        height={62}
        rx={6}
        className="fill-brand-500/8 stroke-brand-500"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      {/* Multi-select toolbar above */}
      <Panel x={tx} y={ty - 64} w={240} h={38}>
        {/* align-left */}
        <g transform={`translate(${tx + 20} ${ty - 64 + 19})`}>
          <path d="M-9 -7 v14" className="stroke-slate-600" strokeWidth={2} strokeLinecap="round" />
          <rect x={-6} y={-6} width={12} height={4} rx={1} className="fill-slate-400" />
          <rect x={-6} y={2} width={8} height={4} rx={1} className="fill-slate-400" />
        </g>
        {/* distribute */}
        <g transform={`translate(${tx + 56} ${ty - 64 + 19})`}>
          <rect x={-9} y={-5} width={4} height={10} rx={1} className="fill-slate-400" />
          <rect x={-2} y={-5} width={4} height={10} rx={1} className="fill-slate-400" />
          <rect x={5} y={-5} width={4} height={10} rx={1} className="fill-slate-400" />
        </g>
        <line
          x1={tx + 78}
          y1={ty - 64 + 8}
          x2={tx + 78}
          y2={ty - 64 + 30}
          className="stroke-slate-200"
          strokeWidth={1.5}
        />
        {/* group */}
        <Label x={tx + 116} y={ty - 64 + 20} anchor="middle" size={10} weight={600} tone="body">
          Group
        </Label>
        <line
          x1={tx + 150}
          y1={ty - 64 + 8}
          x2={tx + 150}
          y2={ty - 64 + 30}
          className="stroke-slate-200"
          strokeWidth={1.5}
        />
        {/* shared fill */}
        <rect
          x={tx + 168}
          y={ty - 64 + 11}
          width={16}
          height={16}
          rx={3}
          className="fill-brand-400 stroke-brand-600"
          strokeWidth={1.5}
        />
        {/* delete */}
        <g transform={`translate(${tx + 214} ${ty - 64 + 19})`}>
          <path
            d="M-6 -4 h12 M-4 -4 v9 a2 2 0 0 0 2 2 h4 a2 2 0 0 0 2 -2 v-9 M-2 -4 v-2 h4 v2"
            className="stroke-rose-500"
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </Panel>
    </Scene>
  );
}

/** A right-click context menu opened over a selected shape on the canvas. */
export function ElementContextMenu() {
  return (
    <Scene w={420} h={240}>
      <Shape x={52} y={86} w={108} h={60} accent label="Node" />
      <SelectionBox x={52} y={86} w={108} h={60} />
      <Menu
        x={150}
        y={64}
        w={144}
        items={['Cut', 'Copy', 'Duplicate', 'Style', 'Link', 'Delete']}
        active={2}
      />
    </Scene>
  );
}

/** The zoom control cluster on its own: minus, level, plus, fit-to-screen. */
export function ZoomControls() {
  return (
    <Scene w={420} h={170}>
      <Shape x={40} y={40} w={70} h={42} label="A" />
      <Shape x={120} y={100} w={70} h={42} accent label="B" />
      <Arrow from={[110, 61]} to={[120, 121]} kind="elbow" />
      <ZoomCluster x={210} y={122} />
      {/* The preset popover, hover-opened above the percentage button */}
      <ZoomPresetPopover x={234} y={28} />
    </Scene>
  );
}

/** A row of tab pills along the bottom: one active board, a couple of others,
 *  a collapsible folder, and the + button. */
export function TabBar() {
  return (
    <Scene w={420} h={150}>
      <Shape x={70} y={34} w={90} h={44} label="Flow" />
      <Panel x={20} y={104} w={384} h={32}>
        {/* Active tab */}
        <rect
          x={30}
          y={110}
          width={74}
          height={20}
          rx={6}
          className="fill-brand-50 stroke-brand-400"
          strokeWidth={1.5}
        />
        <Label x={67} y={120} anchor="middle" size={11} weight={700} tone="accent">
          Flow
        </Label>
        {/* Inactive tab */}
        <Label x={140} y={120} anchor="middle" size={11} weight={500} tone="muted">
          Notes
        </Label>
        {/* Folder tab */}
        <g transform="translate(190 112)">
          <path
            d="M0 4 h6 l2 -3 h8 v12 h-16 Z"
            className="fill-slate-100 stroke-slate-300"
            strokeWidth={1.5}
          />
        </g>
        <Label x={230} y={120} anchor="middle" size={11} weight={500} tone="muted">
          Specs
        </Label>
        {/* Caret showing the folder collapses */}
        <path
          d="M258 117 l4 4 l4 -4"
          className="stroke-slate-400"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
        {/* + button */}
        <rect
          x={362}
          y={110}
          width={28}
          height={20}
          rx={6}
          className="fill-white stroke-slate-300"
          strokeWidth={1.5}
        />
        <Label x={376} y={120} anchor="middle" size={13} weight={700} tone="muted">
          +
        </Label>
      </Panel>
    </Scene>
  );
}

/** The corner quick-controls cluster on its own: search, settings, help. */
export function QuickControls() {
  return (
    <Scene w={420} h={180}>
      <Shape x={70} y={50} w={84} h={48} label="Canvas" />
      <Shape x={210} y={92} w={84} h={48} kind="circle" />
      <QuickStack x={362} y={28} />
    </Scene>
  );
}

/** The bottom-left Map panel: a zoomed-out wireframe of the canvas with a
 *  brand-outlined rectangle marking the part you're currently viewing. */
export function Minimap() {
  return (
    <Scene w={420} h={210}>
      {/* The canvas the map mirrors. */}
      <Shape x={172} y={26} w={68} h={38} label="A" />
      <Shape x={128} y={116} w={62} h={36} accent label="B" />
      <Shape x={258} y={116} w={62} h={36} label="C" />
      <Arrow from={[206, 64]} to={[159, 116]} kind="elbow" />
      <Arrow from={[206, 64]} to={[289, 116]} kind="elbow" />
      {/* The Map panel, bottom-left, with the current-view box. */}
      <Panel x={26} y={120} w={128} h={78} title="MAP">
        <rect
          x={78}
          y={152}
          width={20}
          height={10}
          rx={2}
          className="fill-slate-300 dark:fill-slate-600"
        />
        <rect
          x={62}
          y={176}
          width={17}
          height={9}
          rx={2}
          className="fill-slate-300 dark:fill-slate-600"
        />
        <rect
          x={100}
          y={176}
          width={17}
          height={9}
          rx={2}
          className="fill-slate-300 dark:fill-slate-600"
        />
        <line
          x1={88}
          y1={162}
          x2={70}
          y2={176}
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth={1.2}
        />
        <line
          x1={88}
          y1={162}
          x2={108}
          y2={176}
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth={1.2}
        />
        <rect
          x={52}
          y={150}
          width={64}
          height={40}
          rx={3}
          fill="none"
          className="stroke-brand-500"
          strokeWidth={1.6}
        />
      </Panel>
    </Scene>
  );
}
