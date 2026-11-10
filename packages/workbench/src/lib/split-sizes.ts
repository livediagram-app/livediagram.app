// The split's sizes every editor shares (docs/specs/007-editor/split-view.md): the pane floor and the
// divider's keyboard steps. Each editor's lib/split-view.ts re-exports them beside its own rules.

// The narrowest either pane may get. Either can hold the editor, so both keep the editor's floor:
// Tailwind's `sm` (640 px), the width its palette, Explorer and canvas are laid out for. Under it
// the floating panels cover most of the canvas.
export const SPLIT_MIN_PANE_PX = 640;

// Arrow-key nudge on the divider, and the bigger Shift step (a11y: the separator is a slider).
export const SPLIT_KEY_STEP_PX = 24;
export const SPLIT_KEY_STEP_LARGE_PX = 96;
