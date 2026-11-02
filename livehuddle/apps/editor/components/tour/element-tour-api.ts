import type { TourPreviewAnim } from '@liveworkspace/workbench/lib/concept-tour-preview';

// What an element tour's steps may do (docs/specs/007-editor/element-tours.md), built fresh by ElementTourHost every
// render on the element the tour is on. One facade for every toured kind; each kind's steps use its own part.
export type ElementTourApi = {
  // A timeline or a chart: play an animation on it, never stored, or stop it.
  previewConcept: (anim: TourPreviewAnim) => void;
  // A line, area or scatter chart: open its Chart Data dialog, or close it as its Done does.
  openChartData: () => void;
  closeChartData: () => void;
  clearPreview: () => void;
  // Open the element's own menu (as More or a right-click does), or close it.
  openElementMenu: () => Promise<void>;
  closeElementMenu: () => void;
};
