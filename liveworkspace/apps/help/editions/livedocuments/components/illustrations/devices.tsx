// Supported-devices illustrations (liveworkspace/docs/specs/017-help/help-centre.md): the editor framed inside a desktop
// monitor, a tablet, and a phone, each with the chrome that screen size brings
// (the full strip and corner controls on desktop, the swiping strip on mobile). Composed only
// from the shared primitives so the house style holds.

import { type ReactNode } from 'react';

import { Scene, Panel, Label } from '@liveworkspace/help-site/art/primitives';
import { StripGlyph } from './editor-chrome';
import { EditorView } from './canvas-basics';
import { Sheet, SlideContent } from './doc-page';

// A slide in miniature, drawn at any origin / scale, so the same page can sit inside a roomy monitor or a cramped
// phone without redrawing it per frame: 176 by 99 at scale 1.
function MiniFlow({ x, y, s = 1 }: { x: number; y: number; s?: number; showLabels?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Sheet x={0} y={0} w={176} h={99}>
        <SlideContent x={0} y={0} w={176} h={99} title="Q3 Results" />
      </Sheet>
    </g>
  );
}

// --- Desktop -----------------------------------------------------------------

/** A monitor showing the full editor: the menu button and palette strip, the diagram, the
 *  bottom-right cluster with the zoom, and the bottom bar with the tabs. */
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
      {/* The editor's whole screen, scaled in */}
      <g transform="translate(30 26) scale(0.766)">
        <EditorView w={470} h={219} />
      </g>
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

/** A tablet held in landscape: the roomy screen gets the full layout, the same as a
 *  computer. */
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
      {/* The full layout, as on a computer, scaled in */}
      <g transform="translate(52 36) scale(0.702)">
        <EditorView w={470} h={211} />
      </g>
      <Label x={210} y={210} anchor="middle" size={10} weight={600} tone="muted">
        Full layout, as on a computer
      </Label>
    </Scene>
  );
}

// --- Mobile ------------------------------------------------------------------

/** A phone running the touch editor: the menu card and the palette strip
 *  across the top, the diagram opened zoomed out, the
 *  Fit button and the bottom bar, and a finger interacting with the canvas. */
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
      {/* The menu button (Explorer) in its own card, then the palette strip
          (docs/specs/007-editor/toolbar-layout.md "On a phone"): the selection
          mode, the category bar's glyphs running on (it swipes sideways), and Search at the end. */}
      <rect
        x={162}
        y={40}
        width={14}
        height={18}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <path
        d="M166 45.5h6M166 49h6M166 52.5h6"
        className="stroke-slate-500"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <rect
        x={179}
        y={40}
        width={79}
        height={18}
        rx={5}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      <rect x={182} y={44} width={9} height={10} rx={2.5} className="fill-brand-100" />
      <circle cx={186.5} cy={49} r={2} className="fill-brand-500" />
      {/* The bar's first categories; the rest swipe in. */}
      {(['shapes', 'write', 'concepts', 'components'] as const).map((item, i) => (
        <StripGlyph key={item} item={item} x={197 + i * 10 + (i > 1 ? 4 : 0)} y={49} size={6} />
      ))}
      <line x1={214} y1={45} x2={214} y2={53} className="stroke-slate-200" strokeWidth={0.8} />
      <line x1={240} y1={44} x2={240} y2={54} className="stroke-slate-200" strokeWidth={1} />
      {/* Search, last */}
      <circle cx={246} cy={48.5} r={3} className="fill-none stroke-slate-500" strokeWidth={1.1} />
      <path
        d="M248.2 50.7l2.3 2.3"
        className="stroke-slate-500"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
      {/* The Fit button, bottom-right, and the bottom bar with the tabs. */}
      <rect
        x={232}
        y={172}
        width={24}
        height={13}
        rx={3}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <path
        d="M236 176v-2h3M252 176v-2h-3M236 181v2h3M252 181v2h-3"
        className="stroke-slate-500"
        strokeWidth={1}
        fill="none"
      />
      <rect x={158} y={190} width={104} height={16} className="fill-white" />
      <line x1={158} y1={190} x2={262} y2={190} className="stroke-slate-200" strokeWidth={1} />
      <rect
        x={163}
        y={193}
        width={34}
        height={10}
        rx={3}
        className="fill-white stroke-brand-400"
        strokeWidth={1}
      />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={232 + i * 9} cy={198} r={2.4} className="fill-slate-300" />
      ))}
      {/* Diagram, opened zoomed out */}
      <MiniFlow x={162} y={86} s={0.546} />
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
          {/* Two fingertips moving apart along a diagonal. */}
          <circle cx={-4} cy={4} r={3} className="fill-brand-500" />
          <circle cx={4} cy={-4} r={3} className="fill-brand-500" />
          <path
            d="M-8 8 L-12 12 M-12 7 V12 H-7 M8 -8 L12 -12 M7 -12 H12 V-7"
            className="fill-none stroke-brand-500"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
