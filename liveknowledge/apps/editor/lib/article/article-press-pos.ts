// Where a press on an article's paper puts the caret (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The
// page is drawn as tall as its writing here"): on a continuous page, a press below the writing's last line is the end
// of the writing, as it is under the last line of a word processor's page; elsewhere the place the press hit, else
// the end. Paper pages break into columns, where a press lower than the end can still be in the writing of an earlier
// column, so only a continuous page (one column, one page) takes the rule. Pure: the caller reads the screen.

export function pressedPos(press: {
  // The position the browser found at the (clamped) press, if any.
  hit: number | undefined;
  // The press's y and the foot of the writing's end, in the same screen px; null when the end cannot be measured.
  y: number;
  endBottom: number | null;
  // The end of the writing.
  end: number;
  continuous: boolean;
}): number {
  if (press.continuous && press.endBottom !== null && press.y > press.endBottom) return press.end;
  return press.hit ?? press.end;
}
