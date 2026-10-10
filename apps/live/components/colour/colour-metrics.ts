// The colour picker's measures (docs/specs/004-interface-design/colour-picker.md "How it looks").

// A swatch's target: the touch-targets floor (docs/specs/004-interface-design/touch-targets.md).
export const SWATCH_TARGET_PX = 24;
// The chip inside it: the Draw and Quick Style chip.
export const SWATCH_CHIP_PX = 20;
export const SWATCH_GAP_PX = 4;
// One row holds the ten standard colours exactly.
export const COLOURS_PER_ROW = 10;
export const COLOUR_PICKER_WIDTH =
  COLOURS_PER_ROW * SWATCH_TARGET_PX + (COLOURS_PER_ROW - 1) * SWATCH_GAP_PX;
// The popover's padding round the picker, each side.
export const COLOUR_POPOVER_PADDING = 12;
