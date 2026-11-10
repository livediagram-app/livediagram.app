// What an Inspect session hands the canvas in place of the editor's gestures: stable, so the memoised canvas
// re-renders once as Inspect turns on or off, never per render.
export const NEVER = () => false;
export const NO_EDIT = () => {};
export const NO_DOUBLE_CLICK = () => {};
