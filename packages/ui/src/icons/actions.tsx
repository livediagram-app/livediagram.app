import { Glyph, type IconProps } from './Glyph';

// Edit-action glyphs: the delete / duplicate / copy / edit / lock / refresh /
// add / close / confirm buttons that recur across the editor's toolbars,
// popovers and dialogs. 16-unit viewBox unless noted.

// Lidded bin with two slats. The canonical delete glyph (selection toolbars,
// comment + action popovers).
export function TrashIcon({ size = 16, strokeWidth = 1.75, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
      <path d="M6.5 7v4M9.5 7v4" />
    </Glyph>
  );
}

// A lighter single-stroke bin, used on the theme cards where the full
// TrashIcon reads too heavy against the swatch preview.
export function TrashSimpleIcon({ size = 14, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8" />
    </Glyph>
  );
}

// A square with a second one peeking out below-right: duplicate an element.
export function DuplicateIcon({ size = 16, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} strokeLinecap="butt" {...rest}>
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" />
      <path d="M5.5 13.5h6a1.5 1.5 0 0 0 1.5-1.5v-6" />
    </Glyph>
  );
}

// Two stacked rounded squares, front one bottom-right: copy / duplicate a
// theme or a value.
export function CopyIcon({ size = 14, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      {...rest}
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
    </Glyph>
  );
}

export function PencilIcon({ size = 14, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M11.5 2.5l2 2L6 12l-3 1 1-3z" />
    </Glyph>
  );
}

// Padlock, closed by default; `closed={false}` swings the shackle open.
export function LockIcon({
  closed = true,
  size = 16,
  strokeWidth = 1.75,
  ...rest
}: IconProps & { closed?: boolean }) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <rect x="3" y="7.5" width="10" height="6.5" rx="1.25" />
      {closed ? (
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.5 0v2.5" />
      ) : (
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.4-.7" />
      )}
    </Glyph>
  );
}

// Two chasing arcs: retry / regenerate / reload.
export function RefreshIcon({ size = 14, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 5.5" />
      <path d="M13.5 2.5v3h-3" />
      <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 10.5" />
      <path d="M2.5 13.5v-3h3" />
    </Glyph>
  );
}

export function PlusIcon({ size = 14, strokeWidth = 1.6, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M8 3.5v9M3.5 8h9" />
    </Glyph>
  );
}

// A plus with longer arms, for the canvas's add-note and quick-connect
// buttons where it sits alone in a large target.
export function PlusWideIcon({ size = 14, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M8 3v10M3 8h10" />
    </Glyph>
  );
}

// The X on every dismiss button, on a 14-unit viewBox. The arms span the
// middle half of the box, so a copy drawn on another grid (16 / 12 / 24
// units) is this glyph with its stroke scaled by 14 / units.
export function CloseIcon({ size = 14, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} units={14} {...rest}>
      <path d="M3.5 3.5l7 7M3.5 10.5l7-7" />
    </Glyph>
  );
}

// A tick on a 12-unit viewBox.
export function CheckIcon({ size = 12, strokeWidth = 1.75, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} units={12} {...rest}>
      <path d="M2.5 6.5 5 9l4.5-6" />
    </Glyph>
  );
}

// A paint brush: the format painter (copy one element's style onto others).
export function FormatPainterIcon({ size = 14, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <Glyph size={size} strokeWidth={strokeWidth} {...rest}>
      <path d="M13.5 2.5l-6 6" />
      <path d="M7 8l1.5 1.5" />
      <path d="M6.5 9.5a3 3 0 1 0 1 4.5c.5-.6.5-1.4 0-2-.6-.5-1.4-.5-2 0" />
    </Glyph>
  );
}
