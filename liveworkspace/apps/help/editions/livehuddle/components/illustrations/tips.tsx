// livehuddle's own tips-and-tricks illustrations (liveworkspace/docs/specs/017-help/help-centre.md): keyboard shortcuts
// and the palette strip as a quick-add launchpad. The shortcuts toggle is
// @liveworkspace/help-site/art/illustrations/tips; format-painter and theme scenes are reused from
// canvas.tsx, not redrawn. Composed only from the shared primitives.

import { Scene, Panel, Label } from '@liveworkspace/help-site/art/primitives';
import { TopRow } from './editor-chrome';
import { OfficeFloor } from './space-furniture';

/** A single key cap, sized to its glyph, drawn like a physical keyboard key. */
function KeyCap({ x, y, w = 24, label }: { x: number; y: number; w?: number; label: string }) {
  const h = 24;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <rect x={x + 2} y={y + h - 5} width={w - 4} height={3} rx={1.5} className="fill-slate-200" />
      <Label x={x + w / 2} y={y + h / 2} anchor="middle" size={11} weight={700} tone="strong">
        {label}
      </Label>
    </g>
  );
}

/** The shortcut reference in Settings › Keyboard: the All Shortcuts list,
 *  its Tools group open, each label as the editor words it with its key cap at the right. */
export function KeyboardShortcuts() {
  const rows: [string, string][] = [
    ['E', 'Edit (or V, or 1)'],
    ['W', 'Walk'],
    ['S', 'Search Elements'],
  ];
  return (
    <Scene w={420} h={236} bg="plain">
      <Panel x={80} y={14} w={260} h={208} title="ALL SHORTCUTS">
        <Label x={96} y={50} size={9} weight={700} tone="muted">
          TOOLS
        </Label>
        {rows.map(([key, action], i) => {
          const ry = 62 + i * 30;
          return (
            <g key={key}>
              <Label x={96} y={ry + 12} size={10} tone="body">
                {action}
              </Label>
              <KeyCap x={300} y={ry} label={key} />
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

/** The palette strip across the top of the canvas, beside the logo and menu cards: every category one press
 *  away, Search at its end. */
export function CommandPalette() {
  return (
    <Scene w={460} h={200}>
      <g transform="translate(90 50) scale(0.9)">
        <OfficeFloor x={0} y={0} />
      </g>
      <TopRow w={460} noCorner />
    </Scene>
  );
}
