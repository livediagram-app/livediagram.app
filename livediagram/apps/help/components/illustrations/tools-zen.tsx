// Zen mode, before and after (tools.tsx): the editor with all its chrome, then the same canvas
// with the chrome hidden.

import { useId } from 'react';
import { Scene, Shape, Arrow, Tile, Label } from '@liveworkspace/help-site/art/primitives';

// --- Zen mode ---------------------------------------------------------------

/** The editor with full chrome (header, tab bar, palette, zoom dock) over the
 *  canvas, before zen mode is turned on. */
export function ZenBefore() {
  const grid = `grid-zenbefore-${useId().replace(/:/g, '')}`;
  return (
    <Scene w={420} h={240} bg="none">
      <rect x={0} y={0} width={420} height={240} className="fill-slate-50" />
      {/* Header */}
      <rect
        x={0}
        y={0}
        width={420}
        height={26}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={14} y={14} size={11} weight={700} tone="strong">
        livediagram
      </Label>
      {/* Canvas */}
      <rect x={0} y={26} width={420} height={192} fill={`url(#${grid})`} />
      {/* Tab bar, along the bottom */}
      <rect
        x={0}
        y={218}
        width={420}
        height={22}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1}
      />
      <rect x={10} y={222} width={64} height={14} rx={4} className="fill-brand-500" />
      <rect
        x={80}
        y={222}
        width={64}
        height={14}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <defs>
        <pattern id={grid} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="fill-slate-200" />
        </pattern>
      </defs>
      <Shape x={96} y={108} w={80} h={44} label="A" />
      <Shape x={232} y={108} w={80} h={44} accent label="B" />
      <Arrow from={[176, 130]} to={[232, 130]} />
      {/* Palette: one horizontal strip pinned to the top centre */}
      <rect
        x={140}
        y={34}
        width={140}
        height={30}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Tile x={170} y={49} active size={22}>
        <rect
          x={-6}
          y={-6}
          width={12}
          height={12}
          rx={2}
          className="stroke-white"
          strokeWidth={2}
          fill="none"
        />
      </Tile>
      <Tile x={210} y={49} size={22}>
        <circle r={6} className="stroke-brand-500" strokeWidth={2} fill="none" />
      </Tile>
      <Tile x={250} y={49} size={22}>
        <path
          d="M0 -7 L7 0 L0 7 L-7 0 Z"
          className="stroke-brand-500"
          strokeWidth={2}
          fill="none"
        />
      </Tile>
      {/* Undo / Redo and Layers, left of the zoom dock */}
      <rect
        x={218}
        y={186}
        width={74}
        height={24}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <path
        d="M232 198 a5 5 0 1 1 3 4.5 M232 198 l-2.5 -3 M232 198 l3.5 -1.5"
        className="fill-none stroke-slate-400"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <path
        d="M256 198 a5 5 0 1 0 -3 4.5 M256 198 l2.5 -3 M256 198 l-3.5 -1.5"
        className="fill-none stroke-slate-400"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <path
        d="M272 195 l8 -4 l8 4 l-8 4 Z M272 200 l8 4 l8 -4"
        className="fill-none stroke-slate-400"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      {/* Zoom dock */}
      <rect
        x={300}
        y={186}
        width={104}
        height={24}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={314} y={199} size={13} weight={700} tone="muted">
        −
      </Label>
      <Label x={352} y={199} size={10} weight={600} tone="body" anchor="middle">
        100%
      </Label>
      <Label x={388} y={199} size={13} weight={700} tone="muted">
        +
      </Label>
    </Scene>
  );
}

/** Zen mode on: every panel hidden, just the canvas and the lone zoom dock
 *  (now an exit control). */
export function ZenAfter() {
  return (
    <Scene w={420} h={240}>
      <Shape x={96} y={96} w={80} h={44} label="A" />
      <Shape x={232} y={96} w={80} h={44} accent label="B" />
      <Arrow from={[176, 118]} to={[232, 118]} />
      {/* Lone zoom dock with the exit-zen control */}
      <rect
        x={282}
        y={204}
        width={122}
        height={26}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={296} y={218} size={14} weight={700} tone="muted">
        −
      </Label>
      <Label x={330} y={218} size={10} weight={600} tone="body" anchor="middle">
        100%
      </Label>
      <Label x={362} y={218} size={14} weight={700} tone="muted">
        +
      </Label>
      {/* Compress / exit-zen glyph */}
      <g transform="translate(388 217)">
        <path
          d="M-5 -2 h3 v-3 M2 -5 v3 h3 M5 2 h-3 v3 M-2 5 v-3 h-3"
          className="stroke-brand-500"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </Scene>
  );
}
