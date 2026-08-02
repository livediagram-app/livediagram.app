import type { BorderRadius, BorderStroke, BorderStyle } from '@livediagram/diagram';
import { BORDER_RADII, BORDER_STROKES, BORDER_STYLES } from './context-menu-constants';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  BorderRadiusIcon,
  BorderStrokeIcon,
  BorderStyleIcon,
} from '@/components/palette/palette-icons';
import { BorderGrid } from '@/components/palette/context-menu-rows';
import { onMouseHover } from '@/components/primitives/hover-preview';

// The Border category's three grids: Strength, Pattern, and Radius.
//
// Two menus render them — the single-element menu and the multi-select one —
// and both had written all three out, thirty-odd lines each, differing only in
// where they read the current value from. The grids themselves, the hover
// preview wiring and the revert-on-leave were identical, which is the part
// that matters: a preview that commits on hover and reverts on leave is easy
// to get subtly wrong in one copy and not the other.
//
// `radius` is nullable rather than optional-by-omission because hiding the
// Radius grid is a real state: a shape with no corners to round (and, in the
// multi-select menu, a selection where nothing supports radius) shows Strength
// and Pattern alone.
export function BorderControls({
  strokeWidth,
  strokeStyle,
  radius,
  onCommitBorderStroke,
  onPreviewBorderStroke,
  onCommitBorderStyle,
  onPreviewBorderStyle,
  onCommitBorderRadius,
  onPreviewBorderRadius,
  onPreviewStyleEnd,
}: {
  strokeWidth: BorderStroke;
  strokeStyle: BorderStyle;
  // null hides the Radius grid entirely.
  radius: BorderRadius | null;
  onCommitBorderStroke: (value: BorderStroke) => void;
  onPreviewBorderStroke: (value: BorderStroke) => void;
  onCommitBorderStyle: (value: BorderStyle) => void;
  onPreviewBorderStyle: (value: BorderStyle) => void;
  onCommitBorderRadius: (value: BorderRadius) => void;
  onPreviewBorderRadius: (value: BorderRadius) => void;
  onPreviewStyleEnd: () => void;
}) {
  return (
    <div className="px-2 py-1">
      <BorderGrid label="Strength" cols={5}>
        {BORDER_STROKES.map((v) => (
          <SizeButton
            key={v}
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
            active={strokeStyle === v}
            onClick={() => onCommitBorderStyle(v)}
            onPointerEnter={onMouseHover(() => onPreviewBorderStyle(v))}
            onPointerLeave={onMouseHover(onPreviewStyleEnd)}
          >
            <BorderStyleIcon value={v} />
          </SizeButton>
        ))}
      </BorderGrid>
      {radius !== null ? (
        <BorderGrid label="Radius" cols={5}>
          {BORDER_RADII.map((v) => (
            <SizeButton
              key={v}
              active={radius === v}
              onClick={() => onCommitBorderRadius(v)}
              onPointerEnter={onMouseHover(() => onPreviewBorderRadius(v))}
              onPointerLeave={onMouseHover(onPreviewStyleEnd)}
            >
              <BorderRadiusIcon value={v} />
            </SizeButton>
          ))}
        </BorderGrid>
      ) : null}
    </div>
  );
}
