// The Finish tab's preview (docs/specs/008-canvas/finish.md "Where it is set"): a small sample scene (a step,
// a decision, the arrow between them and a sticky note) drawn in a finish by the same renderer the exports use,
// so the preview is exactly what the canvas will draw. Fixed ids, so the Sketch wobble is the same every time.
import {
  renderElementsToSvg,
  type ArrowElement,
  type Element,
  type Finish,
  type ShapeElement,
  type StickyElement,
  type Tab,
  type TextSize,
} from '@liveplanner/document';
import { withThemeApplied } from '@/lib/tab-theme-apply';

const STEP: ShapeElement = {
  id: 'finish-preview-step',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 15,
  width: 180,
  height: 70,
  label: 'Plan the work',
};
const DECISION: ShapeElement = {
  id: 'finish-preview-decision',
  type: 'shape',
  shape: 'diamond',
  x: 250,
  y: 0,
  width: 130,
  height: 100,
  label: 'Ready?',
};
const LINK: ArrowElement = {
  id: 'finish-preview-arrow',
  type: 'arrow',
  from: { kind: 'pinned', elementId: STEP.id, anchor: 'e' },
  to: { kind: 'pinned', elementId: DECISION.id, anchor: 'w' },
};
const NOTE: StickyElement = {
  id: 'finish-preview-note',
  type: 'sticky',
  x: 440,
  y: 0,
  width: 110,
  height: 100,
  label: 'Ship it',
  textSize: 'md',
};

/** The sample scene, in drawing order. */
export const FINISH_PREVIEW_ELEMENTS: readonly Element[] = [STEP, DECISION, LINK, NOTE];

/** The sample scene drawn in `finish` on the tab's background, in the tab's theme and font, as SVG markup. */
export function finishPreviewSvg(
  finish: Finish,
  tab: { background: string; theme?: string; font?: string; textSize?: TextSize },
): string {
  // The sample in the tab's theme colours, recoloured exactly as picking that theme does, its labels at the size
  // new text takes when one is given (the Text panel).
  const sample = tab.textSize
    ? FINISH_PREVIEW_ELEMENTS.map((el) =>
        el.type === 'arrow' ? el : { ...el, textSize: tab.textSize },
      )
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
