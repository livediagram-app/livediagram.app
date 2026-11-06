// The parts the palette mode illustrations are drawn from (docs/specs/018-help/help-app.md): the Edit | Walk
// toggle at the very start of the palette strip (docs/specs/007-editor/toolbar-layout.md), its two glyphs, and the
// Format Painter's brush, which now sits on the selection toolbar. Select and Hand, Eraser and Format are no longer
// modes to pick, so the picker and its tiles are gone.
//
// Palette-specific by design: ./primitives holds the house style every
// illustration category shares.

import { Label } from '@liveworkspace/help-site/art/primitives';
import { SelectGlyph } from '@liveworkspace/help-site/art/illustrations/palette-modes-parts';

// The glyphs every product's help shares.
export {
  SelectGlyph,
  PainterGlyph,
  LaserGlyph,
  SpotlightGlyph,
  ZenGlyph,
} from '@liveworkspace/help-site/art/illustrations/palette-modes-parts';

/** Footprints (Walk, and Avatar mode's glyph everywhere), drawn about its centre at the size of the shared glyphs:
 *  lucide's footprints at half scale. */
export function FootprintsGlyph({ on = false }: { on?: boolean }) {
  return (
    <g
      transform="translate(-6 -6) scale(0.5)"
      className={on ? 'stroke-white' : 'stroke-slate-500'}
      strokeWidth={2.4}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
      <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" />
      <path d="M16 17h4M4 13h4" />
    </g>
  );
}

/** The width `EditWalkToggle` draws at: icons and labels on a desktop, icons alone on a phone. */
export function editWalkToggleWidth(labels = true, labelSize = 8.5): number {
  return 2 * toggleSegmentWidth(labels, labelSize) + 4;
}

function toggleSegmentWidth(labels: boolean, labelSize: number): number {
  // A glyph, then the four-letter name at roughly 0.53em a character.
  return labels ? Math.round(22 + 4 * labelSize * 0.53) : 24;
}

/** The Edit | Walk toggle, its top-left corner at (x, y), 24 tall: two segments in one pill, the side you are on
 *  filled in the brand colour. `walkDisabled` greys Walk out, as while Start a Space is open. */
export function EditWalkToggle({
  x,
  y,
  on,
  labels = true,
  labelSize = 8.5,
  walkDisabled = false,
}: {
  x: number;
  y: number;
  on: 'edit' | 'walk';
  labels?: boolean;
  labelSize?: number;
  walkDisabled?: boolean;
}) {
  const seg = toggleSegmentWidth(labels, labelSize);
  const sides = [
    { key: 'edit', name: 'Edit', Glyph: SelectGlyph, dim: false },
    { key: 'walk', name: 'Walk', Glyph: FootprintsGlyph, dim: walkDisabled },
  ] as const;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={2 * seg + 4}
        height={24}
        rx={7}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1}
      />
      {sides.map((s, i) => {
        const sx = x + 2 + i * seg;
        const active = s.key === on;
        const gx = labels ? sx + 10 : sx + seg / 2;
        return (
          <g key={s.key} opacity={s.dim ? 0.4 : 1}>
            {active && (
              <rect x={sx} y={y + 2} width={seg} height={20} rx={5} className="fill-brand-500" />
            )}
            {/* White on the solid accent in both appearances (help-art-as-drawn). */}
            <g
              transform={`translate(${gx} ${y + 12}) scale(0.8)`}
              className={active ? 'help-art-as-drawn' : undefined}
            >
              <s.Glyph on={active} />
            </g>
            {labels && (
              <Label
                x={sx + 18}
                y={y + 12.5}
                size={labelSize}
                weight={active ? 700 : 500}
                tone={active ? 'onAccent' : 'body'}
              >
                {s.name}
              </Label>
            )}
          </g>
        );
      })}
    </g>
  );
}
