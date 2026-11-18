// The faint prompt an empty text element draws for an Editor (liveworkspace's template-examples blueprint "The empty
// text prompt"; each editor's docs/specs/008-canvas/canvas-and-palette.md "Text element"): "Text", the word its editor
// shows while typing, at the text's size and alignment, in its own ink faded, so a cleared template shows where its
// words go and double-clicking there opens the text without a jump. Canvas chrome, never content: hidden from screen
// readers, no pointer (the element under it takes the double-click), and dropped by any snapshot of the canvas that
// honours `omitAttr` (livedocuments' animated GIF). The image, vector and PDF exports draw from the elements, so they
// never see it.
import type { TextAlignX, TextAlignY } from '@liveworkspace/model-core/basics';
import type { CSSProperties } from 'react';
import { ALIGN_ITEMS, TEXT_ALIGN } from './label-align';

/** The prompt's words: the same word the text's editor shows while it is empty. */
export const EMPTY_TEXT_PROMPT = 'Text';

/** How faint the prompt draws against the text's own ink. */
export const EMPTY_TEXT_PROMPT_OPACITY = 0.35;

export function EmptyTextPrompt({
  px,
  alignX,
  alignY,
  padding,
  fontFamily,
  omitAttr,
}: {
  // The text's font px, as its words would draw.
  px: number;
  alignX: TextAlignX;
  alignY: TextAlignY;
  // A number of px on every side, or a CSS padding.
  padding: number | string;
  fontFamily?: string;
  // An attribute a canvas snapshot drops the prompt by (livedocuments' `data-gif-omit`).
  omitAttr?: string;
}) {
  const style: CSSProperties = {
    fontSize: `${px}px`,
    alignItems: ALIGN_ITEMS[alignY],
    padding,
    opacity: EMPTY_TEXT_PROMPT_OPACITY,
    ...(fontFamily ? { fontFamily } : {}),
  };
  return (
    <div
      data-empty-text-prompt=""
      {...(omitAttr ? { [omitAttr]: '' } : {})}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex select-none overflow-hidden font-medium leading-tight"
      style={style}
    >
      <div className="w-full whitespace-nowrap" style={{ textAlign: TEXT_ALIGN[alignX] }}>
        {EMPTY_TEXT_PROMPT}
      </div>
    </div>
  );
}
