// Glyphs for the whiteboard dock (docs/specs/023-draw-mode/draw-mode.md). Every one renders through
// the house Glyph primitive (docs/specs/004-interface-design/iconography.md) at the dock's one size
// step, 20px, on the 24-unit grid, so the dock reads as part of the same editor.
import { Glyph, Prims } from '@livediagram/ui';
import {
  lucideEllipsis,
  lucideSettings,
  lucideShapes,
  lucideStickyNote,
  lucideType,
} from '@livediagram/icons/lucide';

// The Toolbar layout strip's tile glyph size, so the dock reads as the strip's twin.
export const DOCK_ICON_PX = 18;

// A marker seen from the side: the body in the dock's ink, the nib and the
// band below in the pen's own colour, the band as thick as the pen draws.
export function PenGlyph({ colour, width }: { colour: string; width: number }) {
  return (
    <Glyph size={DOCK_ICON_PX} units={24}>
      <path d="M7 15 L15.5 6.5 L18 9 L9.5 17.5 L6.4 18 Z" />
      <path d="M6.4 18 L7 15 L9.5 17.5 Z" fill={colour} stroke={colour} />
      <path d="M4 21.5 H20" stroke={colour} strokeWidth={1 + width * 0.75} />
    </Glyph>
  );
}

export function StickyGlyph() {
  return (
    <Glyph size={DOCK_ICON_PX} units={24}>
      <Prims prims={lucideStickyNote} />
    </Glyph>
  );
}

export function TextGlyph() {
  return (
    <Glyph size={DOCK_ICON_PX} units={24}>
      <Prims prims={lucideType} />
    </Glyph>
  );
}

export function ShapesGlyph() {
  return (
    <Glyph size={DOCK_ICON_PX} units={24}>
      <Prims prims={lucideShapes} />
    </Glyph>
  );
}

// Shape recognition: a rough loop beside the clean circle it becomes.
export function RecogniseGlyph() {
  return (
    <Glyph size={DOCK_ICON_PX} units={24}>
      <path d="M3 14 C3 8 9 6 10.5 10.5 S6 18 3 14" />
      <path d="M12.3 12 H14.6 M13.6 10.6 L15 12 L13.6 13.4" />
      <circle cx="19" cy="12" r="3" />
    </Glyph>
  );
}

// Recognition off: the rough stroke stays as drawn.
export function OffGlyph() {
  return (
    <Glyph size={DOCK_ICON_PX} units={24}>
      <path d="M5 15 C5 8 13 5 15.5 10.5 S10 20 6 16.5" />
    </Glyph>
  );
}

export function MoreGlyph() {
  return (
    <Glyph size={DOCK_ICON_PX} units={24}>
      <Prims prims={lucideEllipsis} />
    </Glyph>
  );
}

// Settings: the cog.
export function SettingsGlyph() {
  return (
    <Glyph size={DOCK_ICON_PX} units={24}>
      <Prims prims={lucideSettings} />
    </Glyph>
  );
}

export function ShapeGlyph({ id }: { id: string }) {
  switch (id) {
    case 'rectangle':
      return (
        <Glyph size={DOCK_ICON_PX} units={24}>
          <rect x="3" y="6" width="18" height="12" rx="1.5" />
        </Glyph>
      );
    case 'ellipse':
      return (
        <Glyph size={DOCK_ICON_PX} units={24}>
          <ellipse cx="12" cy="12" rx="9" ry="6.5" />
        </Glyph>
      );
    case 'triangle':
      return (
        <Glyph size={DOCK_ICON_PX} units={24}>
          <path d="M12 4 L21 19.5 H3 Z" />
        </Glyph>
      );
    case 'diamond':
      return (
        <Glyph size={DOCK_ICON_PX} units={24}>
          <path d="M12 3 L21 12 L12 21 L3 12 Z" />
        </Glyph>
      );
    case 'cylinder':
      return (
        <Glyph size={DOCK_ICON_PX} units={24}>
          <ellipse cx="12" cy="6" rx="7" ry="2.5" />
          <path d="M5 6 V18 C5 19.4 8.1 20.5 12 20.5 S19 19.4 19 18 V6" />
        </Glyph>
      );
    case 'line':
      return (
        <Glyph size={DOCK_ICON_PX} units={24}>
          <path d="M5 19 L19 5" />
        </Glyph>
      );
    default:
      return (
        <Glyph size={DOCK_ICON_PX} units={24}>
          <path d="M5 19 L19 5 M11 5 H19 V13" />
        </Glyph>
      );
  }
}

// The three board backgrounds, drawn as small swatches of themselves.
export function BackgroundGlyph({ id }: { id: string }) {
  return (
    <Glyph size={DOCK_ICON_PX} units={24}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      {id === 'dots'
        ? [8, 12, 16].flatMap((x) =>
            [8, 12, 16].map((y) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="currentColor" stroke="none" />
            )),
          )
        : null}
      {id === 'grid' ? <path d="M9 3 V21 M15 3 V21 M3 9 H21 M3 15 H21" /> : null}
    </Glyph>
  );
}
