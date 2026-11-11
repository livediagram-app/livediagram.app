// The Finish tab's preview (docs/specs/008-canvas/finish.md "Where it is set"): a small sample scene (two sticky
// notes and a plant) drawn in a finish by the same renderer the exports use,
// so the preview is exactly what the canvas will draw. Fixed ids, so the Sketch wobble is the same every time. Its
// step and decision were diagram shapes until those left livehuddle
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5).
import {
  renderElementsToSvg,
  type Element,
  type Finish,
  type ShapeElement,
  type StickyElement,
  type Tab,
  type TextSize,
} from '@livehuddle/document';
import { withThemeApplied } from '@/lib/tab-theme-apply';

const PLAN: StickyElement = {
  id: 'finish-preview-plan',
  type: 'sticky',
  x: 0,
  y: 0,
  width: 160,
  height: 100,
  label: 'Plan the work',
  textSize: 'md',
};
// A Space piece, so the preview shows how the finish draws the Space as well as its notes.
const PLANT: ShapeElement = {
  id: 'finish-preview-plant',
  type: 'shape',
  shape: 'plant',
  x: 210,
  y: 6,
  width: 56,
  height: 88,
  label: '',
};
const NOTE: StickyElement = {
  id: 'finish-preview-note',
  type: 'sticky',
  x: 316,
  y: 0,
  width: 110,
  height: 100,
  label: 'Ship it',
  textSize: 'md',
};

/** The sample scene, in drawing order. */
export const FINISH_PREVIEW_ELEMENTS: readonly Element[] = [PLAN, PLANT, NOTE];

/** The sample scene drawn in `finish` on the tab's background, in the tab's theme and font, as SVG markup. */
export function finishPreviewSvg(
  finish: Finish,
  tab: { background: string; theme?: string; font?: string; textSize?: TextSize },
): string {
  // The sample in the tab's theme colours, recoloured exactly as picking that theme does, its labels at the size
  // new text takes when one is given (the Text panel).
  const sample = tab.textSize
    ? FINISH_PREVIEW_ELEMENTS.map((el) => ({ ...el, textSize: tab.textSize }) as Element)
    : [...FINISH_PREVIEW_ELEMENTS];
  const elements = tab.theme
    ? withThemeApplied({ id: 'finish-preview', name: '', elements: sample }, tab.theme).elements
    : sample;
  const previewTab = {
    id: 'finish-preview',
    name: 'Finish preview',
    elements,
    finish,
    backgroundColor: tab.background,
    ...(tab.theme ? { theme: tab.theme } : {}),
    ...(tab.font ? { font: tab.font } : {}),
  } as Tab;
  return renderElementsToSvg(previewTab, { padding: 16 });
}
