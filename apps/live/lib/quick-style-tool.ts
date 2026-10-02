// The quick style panel for a whiteboard tool in hand (docs/specs/023-whiteboard/whiteboard.md "The
// quick style panel stays"): with a shape, line, arrow or text tool armed and nothing selected, the
// panel styles what that tool draws next. It shows a stand-in element, the one the tool would draw
// plain, dressed by the board's style memory; a choice is remembered for the tool's kind.
import {
  createPath,
  createShape,
  createText,
  type Element,
  type ThemeDefinition,
} from '@livediagram/document';
import type { PendingDraw } from './draw-mode';
import { buildDrawnArrow } from './draw-commit';
import { WHITEBOARD_SHAPES, boardShape } from './whiteboard-tool';

const PATH_PHANTOM = [
  { x: 0, y: 0, mode: 'corner' },
  { x: 40, y: 0, mode: 'corner' },
  { x: 20, y: 30, mode: 'corner' },
] as const;

/** What the armed tool would draw, plain; null for a tool the panel does not style. */
export function toolPhantom(intent: PendingDraw, theme: ThemeDefinition): Element | null {
  if (intent.type === 'shape') return boardShape(createShape(intent.kind, 0, 0));
  if (intent.type === 'arrow') {
    return boardShape(
      buildDrawnArrow(0, 0, 120, 0, [], theme, { ends: intent.ends, unpainted: true }),
    );
  }
  if (intent.type === 'text') return createText(0, 0);
  // A closed stand-in, so the panel offers the fill a path takes once it closes (blueprint P11).
  if (intent.type === 'path') return boardShape(createPath(PATH_PHANTOM, true));
  return null;
}

/** The caption naming the tool's next mark: "Next rectangle". */
export function toolCaption(intent: PendingDraw): string {
  if (intent.type === 'path') return 'Next path';
  if (intent.type === 'text') return 'Next text box';
  const shape = WHITEBOARD_SHAPES.find((s) =>
    intent.type === 'shape'
      ? s.intent.type === 'shape' && s.intent.kind === intent.kind
      : intent.type === 'arrow' && s.intent.type === 'arrow' && s.intent.ends === intent.ends,
  );
  return `Next ${(shape?.label ?? 'shape').toLowerCase()}`;
}
