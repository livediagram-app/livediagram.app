// The quick style panel for a tool in hand (docs/specs/023-whiteboard/whiteboard.md "The quick
// style panel stays", on every tab since docs/specs/008-canvas/quick-style-panel.md "With a tool in
// hand"): with a shape, line, arrow, text or path tool armed and nothing selected, the panel styles
// what that tool draws next. It shows a stand-in element, the one the tool would draw plain,
// dressed by the tab's style memory; a choice is remembered for the tool's kind.
import {
  createPath,
  createShape,
  createText,
  type Element,
  type Tab,
  type ThemeDefinition,
} from '@livediagram/document';
import { deriveNewBoxedColours } from './themes';
import { kindLabel } from './element-names';
import type { PendingDraw } from './draw-mode';
import { buildDrawnArrow } from './draw-commit';
import { WHITEBOARD_SHAPES, boardShape } from './whiteboard-tool';

const PATH_PHANTOM = [
  { x: 0, y: 0, mode: 'corner' },
  { x: 40, y: 0, mode: 'corner' },
  { x: 20, y: 30, mode: 'corner' },
] as const;

/** What the armed tool would draw, plain; null for a tool the panel does not style. */
// `diagram`: the diagram tab the tool draws on, whose new shapes take the theme's colours (as
// buildDrawnBoxed dresses them) and whose arrows are painted; absent on a whiteboard, where a
// shape is unfilled and everything is drawn in the board's ink.
export function toolPhantom(
  intent: PendingDraw,
  theme: ThemeDefinition,
  diagram?: Pick<Tab, 'backgroundColor' | 'patternColor' | 'theme'>,
): Element | null {
  if (intent.type === 'shape') {
    const shape = createShape(intent.kind, 0, 0);
    return diagram ? { ...shape, ...deriveNewBoxedColours(shape, diagram) } : boardShape(shape);
  }
  if (intent.type === 'arrow') {
    return buildDrawnArrow(0, 0, 120, 0, [], theme, { ends: intent.ends, unpainted: !diagram });
  }
  if (intent.type === 'text') return createText(0, 0);
  // A closed stand-in, so the panel offers the fill a path takes once it closes (blueprint P11).
  if (intent.type === 'path') return createPath(PATH_PHANTOM, true);
  return null;
}

/** The caption naming the tool's next mark: "Next rectangle". */
// On a diagram tab a shape is named as the palette names it ("Next square"); a whiteboard names its
// dock shapes its own way ("Next rectangle").
export function toolCaption(intent: PendingDraw, whiteboard = true): string {
  if (intent.type === 'path') return 'Next path';
  if (intent.type === 'text') return 'Next text box';
  if (!whiteboard && intent.type === 'shape') {
    return `Next ${kindLabel(createShape(intent.kind, 0, 0)).toLowerCase()}`;
  }
  const shape = WHITEBOARD_SHAPES.find((s) =>
    intent.type === 'shape'
      ? s.intent.type === 'shape' && s.intent.kind === intent.kind
      : intent.type === 'arrow' && s.intent.type === 'arrow' && s.intent.ends === intent.ends,
  );
  if (shape) return `Next ${shape.label.toLowerCase()}`;
  // Any other shape kind (the palette's catalogue): its own name, "Next hexagon".
  return intent.type === 'shape'
    ? `Next ${kindLabel(createShape(intent.kind, 0, 0)).toLowerCase()}`
    : 'Next shape';
}
