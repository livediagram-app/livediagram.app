// Supported-devices illustrations (spec/55): the editor framed inside a desktop
// monitor, a tablet, and a phone, each with the chrome that screen size brings
// (full floating palette on desktop, a compact dock on mobile). Composed only
// from the shared primitives so the house style holds.

import { type ReactNode } from 'react';

import { Scene, Shape, Arrow, Panel, Tile, Label, Tabs } from './primitives';

// A tiny stand-in flow drawn at any origin / scale, so the same diagram can sit
// inside a roomy monitor or a cramped phone without redrawing it per frame.
function MiniFlow({
  x,
  y,
  s = 1,
  showLabels = true,
}: {
  x: number;
  y: number;
  s?: number;
  showLabels?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shape x={0} y={20} w={70} h={36} kind="rect" label={showLabels ? 'Start' : undefined} />
      <Shape x={110} y={20} w={64} h={36} kind="diamond" />
      <Shape
        x={110}
        y={84}
        w={70}
        h={34}
        kind="rect"
        accent
        label={showLabels ? 'Done' : undefined}
      />
      <Arrow from={[70, 38]} to={[110, 38]} />
      <Arrow from={[142, 56]} to={[142, 84]} />
    </g>
  );
}

// --- Desktop -----------------------------------------------------------------

/** A monitor showing the full editor: the tab bar, the floating palette, the
 *  diagram, and the zoom dock, all at once. */
export function DesktopEditor() {
  return (
    <Scene w={420} h={240} bg="plain">
      {/* Monitor bezel + screen */}
      <rect
        x={20}
        y={16}
        width={380}
        height={188}
        rx={10}
        className="fill-white stroke-slate-300"
        strokeWidth={3}
      />
      <rect x={30} y={26} width={360} height={168} rx={4} className="fill-slate-50" />
      {/* Tab bar */}
      <Tabs x={40} y={34} items={['Overview', 'Detail', '+']} active={0} tabW={64} h={22} />
      {/* Diagram on the canvas */}
      <g transform="translate(48 76) scale(0.92)">
        <MiniFlow x={0} y={0} />
      </g>
      {/* Floating palette, docked right */}
      <Panel x={296} y={66} w={84} h={116} title="PALETTE">
        <Tile x={307} y={100} active>
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
        <Tile x={343} y={100}>
          <circle r={7} className="stroke-brand-500" strokeWidth={2} fill="none" />
        </Tile>
        <Tile x={307} y={138}>
          <path
            d="M0 -8 L8 0 L0 8 L-8 0 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={343} y={138}>
          <path
            d="M-7 0 h14 M7 -4 l3 4 -3 4"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
      </Panel>
      {/* Zoom dock, bottom-left */}
      <Panel x={40} y={160} w={92} h={28}>
        <Label x={54} y={175} size={14} weight={700} tone="muted">
          −
        </Label>
        <Label x={86} y={175} size={10} weight={600} tone="body" anchor="middle">
          100%
        </Label>
        <Label x={120} y={175} size={14} weight={700} tone="muted">
          +
        </Label>
      </Panel>
      {/* Monitor stand */}
      <rect x={196} y={204} width={28} height={16} className="fill-slate-200" />
      <rect x={166} y={220} width={88} height={7} rx={3.5} className="fill-slate-300" />
    </Scene>
  );
}

/** A keyboard with a few editor shortcuts called out, the desktop-only fast path. */
export function DesktopShortcuts() {
  const keys: { label: string; sub: string }[] = [
    { label: '⌘Z', sub: 'Undo' },
    { label: '⌘C', sub: 'Copy' },
    { label: '⌘D', sub: 'Duplicate' },
    { label: 'Shift', sub: 'Resize lock' },
  ];
  return (
    <Scene w={420} h={170} bg="plain">
      <Panel x={48} y={30} w={324} h={108}>
        <Label x={64} y={52} size={10} weight={700} tone="muted">
          KEYBOARD SHORTCUTS
        </Label>
        {keys.map((k, i) => {
          const kx = 64 + i * 78;
          return (
            <g key={i}>
              <rect
                x={kx}
                y={66}
                width={62}
                height={34}
                rx={7}
                className="fill-slate-50 stroke-slate-300"
                strokeWidth={1.5}
              />
              <Label x={kx + 31} y={84} anchor="middle" size={11} weight={700} tone="accent">
                {k.label}
              </Label>
              <Label x={kx + 31} y={114} anchor="middle" size={9} tone="muted">
                {k.sub}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

// --- Tablet ------------------------------------------------------------------

/** A tablet held in landscape: the roomy screen gets the full layout with the
 *  floating palette, the same as a computer. */
export function TabletLandscape() {
  return (
    <Scene w={420} h={220} bg="plain">
      {/* Tablet body (wide) */}
      <rect
        x={26}
        y={24}
        width={368}
        height={172}
        rx={16}
        className="fill-white stroke-slate-300"
        strokeWidth={3}
      />
      <circle cx={40} cy={110} r={3} className="fill-slate-300" />
      <rect x={52} y={36} width={330} height={148} rx={6} className="fill-slate-50" />
      {/* Tab bar */}
      <Tabs x={62} y={44} items={['Overview', 'Detail']} active={0} tabW={62} h={20} />
      {/* Diagram */}
      <g transform="translate(70 78) scale(0.92)">
        <MiniFlow x={0} y={0} />
      </g>
      {/* Floating palette, like desktop */}
      <Panel x={298} y={72} w={76} h={104} title="PALETTE">
        <Tile x={308} y={104} active>
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
        <Tile x={340} y={104}>
          <circle r={7} className="stroke-brand-500" strokeWidth={2} fill="none" />
        </Tile>
        <Tile x={308} y={138}>
          <path
            d="M0 -8 L8 0 L0 8 L-8 0 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={340} y={138}>
          <path
            d="M-7 0 h14 M7 -4 l3 4 -3 4"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
      </Panel>
      <Label x={210} y={210} anchor="middle" size={10} weight={600} tone="muted">
        Landscape: full layout
      </Label>
    </Scene>
  );
}

/** Rotating a tablet between portrait (compact dock) and landscape (full panels),
 *  with a rotate arrow between the two states. */
export function TabletRotate() {
  return (
    <Scene w={420} h={220} bg="plain">
      {/* Portrait tablet with a compact dock */}
      <g>
        <rect
          x={30}
          y={24}
          width={108}
          height={168}
          rx={14}
          className="fill-white stroke-slate-300"
          strokeWidth={2.5}
        />
        <rect x={40} y={42} width={88} height={132} rx={5} className="fill-slate-50" />
        {/* compact dock, top corner */}
        <rect
          x={46}
          y={48}
          width={48}
          height={16}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <circle cx={55} cy={56} r={3} className="fill-brand-400" />
        <circle cx={70} cy={56} r={3} className="fill-slate-300" />
        <circle cx={85} cy={56} r={3} className="fill-slate-300" />
        <g transform="translate(44 76) scale(0.42)">
          <MiniFlow x={0} y={0} showLabels={false} />
        </g>
        <Label x={84} y={208} anchor="middle" size={10} weight={600} tone="muted">
          Portrait: dock
        </Label>
      </g>
      {/* Rotate arrow */}
      <g transform="translate(210 100)">
        <path
          d="M-18 -8 a18 18 0 1 1 -4 22"
          className="stroke-brand-400"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
        <path d="M-26 8 l4 8 8 -4 Z" className="fill-brand-400" />
      </g>
      {/* Landscape tablet with full panels */}
      <g>
        <rect
          x={252}
          y={56}
          width={140}
          height={104}
          rx={14}
          className="fill-white stroke-slate-300"
          strokeWidth={2.5}
        />
        <rect x={262} y={66} width={120} height={84} rx={5} className="fill-slate-50" />
        <g transform="translate(266 74) scale(0.34)">
          <MiniFlow x={0} y={0} showLabels={false} />
        </g>
        {/* mini floating palette */}
        <rect
          x={348}
          y={74}
          width={28}
          height={66}
          rx={5}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <rect
          x={354}
          y={82}
          width={16}
          height={14}
          rx={3}
          className="fill-brand-100 stroke-brand-300"
          strokeWidth={1}
        />
        <rect
          x={354}
          y={102}
          width={16}
          height={14}
          rx={3}
          className="fill-slate-100 stroke-slate-200"
          strokeWidth={1}
        />
        <Label x={322} y={180} anchor="middle" size={10} weight={600} tone="muted">
          Landscape: panels
        </Label>
      </g>
    </Scene>
  );
}

// --- Mobile ------------------------------------------------------------------

/** A phone running the touch editor: the Toolbar strip across the top (a
 *  phone's default layout), the diagram zoomed to fit, and a finger
 *  interacting with the canvas. */
export function MobileEditor() {
  return (
    <Scene w={420} h={240} bg="plain">
      {/* Phone body */}
      <rect
        x={150}
        y={14}
        width={120}
        height={212}
        rx={20}
        className="fill-white stroke-slate-300"
        strokeWidth={3}
      />
      <rect x={188} y={22} width={44} height={5} rx={2.5} className="fill-slate-200" />
      <rect x={158} y={34} width={104} height={172} rx={6} className="fill-slate-50" />
      {/* The Toolbar strip, a phone's default layout (spec/148): menu button,
          selection mode, category, as many tiles as fit (three here), More. */}
      <rect
        x={162}
        y={40}
        width={96}
        height={18}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      {/* Menu button (☰) */}
      <path
        d="M167 45.5h7M167 49h7M167 52.5h7"
        className="stroke-slate-500"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <path d="M178 44v10M204 44v10M234 44v10" className="stroke-slate-200" strokeWidth={1} />
      {/* Selection mode + category pickers, icon-only on a phone */}
      <rect x={181} y={44} width={9} height={10} rx={2.5} className="fill-brand-100" />
      <rect x={192} y={44} width={9} height={10} rx={2.5} className="fill-brand-100" />
      <circle cx={185.5} cy={49} r={2} className="fill-brand-500" />
      <path
        d="M196.5 46.5l0.9 1.8 2 0.3-1.4 1.4 0.3 2-1.8-0.9-1.8 0.9 0.3-2-1.4-1.4 2-0.3z"
        className="fill-brand-500"
      />
      {/* Three shape tiles */}
      <rect
        x={206}
        y={46}
        width={6}
        height={6}
        rx={1}
        className="fill-none stroke-slate-500"
        strokeWidth={1}
      />
      <circle cx={218.5} cy={49} r={3.2} className="fill-none stroke-slate-500" strokeWidth={1} />
      <path
        d="M229 45.6l3.4 3.4-3.4 3.4-3.4-3.4z"
        className="fill-none stroke-slate-500"
        strokeWidth={1}
      />
      {/* More */}
      <rect x={237} y={44} width={17} height={10} rx={2.5} className="fill-brand-100" />
      <circle cx={241.5} cy={49} r={0.9} className="fill-brand-500" />
      <circle cx={245} cy={49} r={0.9} className="fill-brand-500" />
      <circle cx={248.5} cy={49} r={0.9} className="fill-brand-500" />
      {/* Diagram zoomed to fit */}
      <g transform="translate(164 78) scale(0.5)">
        <MiniFlow x={0} y={0} showLabels={false} />
      </g>
      {/* Home indicator */}
      <rect x={194} y={214} width={32} height={4} rx={2} className="fill-slate-300" />
      {/* Touch finger / tap ring on the canvas */}
      <g transform="translate(196 150)">
        <circle r={14} className="fill-brand-500/15 stroke-brand-400" strokeWidth={2} />
        <circle r={5} className="fill-brand-500" />
      </g>
    </Scene>
  );
}

/** The four touch gestures: pinch to zoom, drag to pan, tap to select, and
 *  press-and-hold for the menu. */
export function TouchGestures() {
  const tiles: { title: string; glyph: ReactNode }[] = [
    {
      title: 'Pinch',
      glyph: (
        <g>
          <path
            d="M-9 -9 L9 9 M-9 9 L9 -9"
            className="stroke-brand-500"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle r={3.5} className="fill-brand-500" />
        </g>
      ),
    },
    {
      title: 'Drag',
      glyph: (
        <g>
          <path
            d="M-10 0 H10 M6 -4 l4 4 -4 4 M-6 -4 l-4 4 4 4"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ),
    },
    {
      title: 'Tap',
      glyph: (
        <g>
          <circle r={9} className="fill-none stroke-brand-300" strokeWidth={2} />
          <circle r={4} className="fill-brand-500" />
        </g>
      ),
    },
    {
      title: 'Hold',
      glyph: (
        <g>
          <circle r={9} className="fill-brand-500/15 stroke-brand-400" strokeWidth={2} />
          <circle r={4} className="fill-brand-500" />
        </g>
      ),
    },
  ];
  return (
    <Scene w={420} h={134} bg="plain">
      {tiles.map((t, i) => {
        const tx = 28 + i * 98;
        return (
          <g key={i}>
            <rect
              x={tx}
              y={26}
              width={82}
              height={82}
              rx={12}
              className="fill-white stroke-slate-200"
              strokeWidth={2}
            />
            <g transform={`translate(${tx + 41} 58)`}>{t.glyph}</g>
            <Label x={tx + 41} y={92} anchor="middle" size={10} weight={600} tone="body">
              {t.title}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}
