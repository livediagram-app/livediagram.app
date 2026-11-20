// Zen mode, before and after (docs/specs/007-editor/zen-mode.md, chrome/ZoomControls.tsx): the editor with all its
// chrome, then the same canvas with the chrome hidden but for the zoom card, which carries the exit button.

import { Arrow, Label, Scene, Shape } from '@liveworkspace/help-site/art/primitives';
import { Card, EditorFrame, Icon, type Prim } from './editor-chrome';

const W = 540;
const H = 280;

/** The flow both scenes show, in the same place so the two read as one canvas. */
function Flow() {
  return (
    <g>
      <Shape x={170} y={112} w={84} h={46} label="A" />
      <Shape x={310} y={112} w={84} h={46} accent label="B" />
      <Arrow from={[254, 135]} to={[310, 135]} />
    </g>
  );
}

/** The editor with all its chrome, before zen mode is turned on: the top row, the corner cluster and the bottom bar. */
export function ZenBefore() {
  return (
    <Scene w={W} h={H}>
      <Flow />
      <EditorFrame w={W} h={H} />
    </Scene>
  );
}

// The exit-zen glyph: four corners pointing in.
const ZEN_EXIT: readonly Prim[] = [
  {
    t: 'path',
    d: 'M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3',
  },
];
const MINUS: readonly Prim[] = [{ t: 'path', d: 'M5 12h14' }];
const PLUS: readonly Prim[] = [{ t: 'path', d: 'M5 12h14M12 5v14' }];

/** Zen mode on: every bar and panel hidden, just the canvas and the zoom card, now with the exit button at its end. */
export function ZenAfter() {
  const x = W - 8 - 104;
  const y = H - 8 - 24;
  const cy = y + 12;
  return (
    <Scene w={W} h={H}>
      <Flow />
      <Card x={x} y={y} w={104} h={24}>
        <Icon prims={MINUS} x={x + 12} y={cy} size={8} />
        <Label x={x + 40} y={cy + 0.5} size={9} weight={500} tone="strong" anchor="middle">
          100%
        </Label>
        <Icon prims={PLUS} x={x + 68} y={cy} size={8} />
        <line
          x1={x + 80}
          y1={y}
          x2={x + 80}
          y2={y + 24}
          className="stroke-slate-100"
          strokeWidth={0.75}
        />
        <rect x={x + 83} y={y + 3} width={18} height={18} rx={4} className="fill-brand-50" />
        <Icon prims={ZEN_EXIT} x={x + 92} y={cy} size={9} className="stroke-brand-700" />
      </Card>
    </Scene>
  );
}
