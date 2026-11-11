import type { BorderStroke, BorderStyle } from '@livehuddle/document';
import { BORDER_STROKES, BORDER_STYLES } from './context-menu-constants';
import { SizeButton } from '@/components/palette/palette-controls';
import { BorderStrokeIcon, BorderStyleIcon } from '@/components/palette/palette-style-previews';
import { BorderGrid } from '@/components/palette/context-menu-rows';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';

// The Border category's two grids: Strength and Pattern. Its Radius grid served only the square, and left with the
// diagram shapes (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5).
//
// Two menus render them — the single-element menu and the multi-select one —
// and both had written all three out, thirty-odd lines each, differing only in
// where they read the current value from. The grids themselves, the hover
// preview wiring and the revert-on-leave were identical, which is the part
// that matters: a preview that commits on hover and reverts on leave is easy
// to get subtly wrong in one copy and not the other.
export function BorderControls({
  strokeWidth,
  strokeStyle,
  onCommitBorderStroke,
  onPreviewBorderStroke,
  onCommitBorderStyle,
  onPreviewBorderStyle,
  onPreviewStyleEnd,
}: {
  strokeWidth: BorderStroke;
  strokeStyle: BorderStyle;
  onCommitBorderStroke: (value: BorderStroke) => void;
  onPreviewBorderStroke: (value: BorderStroke) => void;
  onCommitBorderStyle: (value: BorderStyle) => void;
  onPreviewBorderStyle: (value: BorderStyle) => void;
  onPreviewStyleEnd: () => void;
}) {
  return (
    <div className="px-2 py-1">
      <BorderGrid label="Strength" cols={5}>
        {BORDER_STROKES.map((v) => (
          <SizeButton
            key={v}
            label={tileLabel(v)}
            active={strokeWidth === v}
            onClick={() => onCommitBorderStroke(v)}
            onPointerEnter={onMouseHover(() => onPreviewBorderStroke(v))}
            onPointerLeave={onMouseHover(onPreviewStyleEnd)}
          >
            <BorderStrokeIcon value={v} />
          </SizeButton>
        ))}
      </BorderGrid>
      <BorderGrid label="Pattern" cols={3}>
        {BORDER_STYLES.map((v) => (
          <SizeButton
            key={v}
            label={tileLabel(v)}
            active={strokeStyle === v}
            onClick={() => onCommitBorderStyle(v)}
            onPointerEnter={onMouseHover(() => onPreviewBorderStyle(v))}
            onPointerLeave={onMouseHover(onPreviewStyleEnd)}
          >
            <BorderStyleIcon value={v} />
          </SizeButton>
        ))}
      </BorderGrid>
    </div>
  );
}

// A tile's name for its tooltip and screen readers ('dash-dot' -> 'Dash Dot'): the tiles draw only an icon.
const tileLabel = (v: string) =>
  v
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
