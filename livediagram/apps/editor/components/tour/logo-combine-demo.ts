// The Logo tour's Combine demonstration (docs/specs/007-editor/pages-tour.md "Logo track"): two overlapping shapes
// placed on the tour page and selected, so Combine shows on the selection toolbar; then united into one, as Unite does.
// Placed, swapped and taken away with no history (useTourSquare), so the page is left as it was and Undo never brings
// them back. The editor registers what it does (useLogoCombineDemo), as PAGE_PANEL is for the page's panel.

type CombineDemo = {
  place: (pageId: string) => Promise<boolean>;
  unite: () => Promise<boolean>;
  clear: () => void;
  // The one shape the demonstration has on the page once united, else null.
  shape: () => string | null;
};

let demo: CombineDemo | null = null;

/** Registered by the editor while it is mounted. */
export function registerCombineDemo(next: CombineDemo | null): void {
  demo = next;
}

/** Places the two shapes on the page and selects them; false when they could not be placed. */
export const placeCombineDemo = (pageId: string) => demo?.place(pageId) ?? Promise.resolve(false);
/** Unites the placed shapes into one and selects it. */
export const uniteCombineDemo = () => demo?.unite() ?? Promise.resolve(false);
/** The united shape's id, once there is one. */
export const combineDemoShape = () => demo?.shape() ?? null;
/** Takes away what the demonstration placed. */
export const clearCombineDemo = () => demo?.clear();
