// The quick style panel for a whiteboard tool in hand (docs/specs/023-whiteboard/whiteboard.md "The
// quick style panel stays"): with a shape, line, arrow or text tool armed and nothing selected, the
// panel styles what that tool draws next. It shows a stand-in element, the one the tool would draw
// plain, dressed by the board's style memory; a choice is remembered for the tool's kind.
import { createShape, createText, type Element, type ThemeDefinition } from '@livediagram/document';
import type { PendingDraw } from './draw-mode';
import { buildDrawnArrow } from './draw-commit';
import { WHITEBOARD_SHAPES, boardShape } from './whiteboard-tool';

/** What the armed tool would draw, plain; null for a tool the panel does not style. */
export function toolPhantom(intent: PendingDraw, theme: ThemeDefinition): Element | null {
  if (intent.type === 'shape') return boardShape(createShape(intent.kind, 0, 0));
  if (intent.type === 'arrow') {
    return buildDrawnArrow(0, 0, 120, 0, [], theme, { ends: intent.ends, unpainted: true });
  }
  if (intent.type === 'text') return createText(0, 0);
  return null;
}

/** The caption naming the tool's next mark: "Next rectangle". */
export function toolCaption(intent: PendingDraw): string {
  if (intent.type === 'text') return 'Next text box';
  const shape = WHITEBOARD_SHAPES.find((s) =>
    intent.type === 'shape'
      ? s.intent.type === 'shape' && s.intent.kind === intent.kind
      : intent.type === 'arrow' && s.intent.type === 'arrow' && s.intent.ends === intent.ends,
  );
  return `Next ${(shape?.label ?? 'shape').toLowerCase()}`;
}
