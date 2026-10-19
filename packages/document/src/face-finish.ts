// The rules a face's own parts follow in their element's finish (docs/specs/008-canvas/finish.md "Faces"), shared by
// the canvas (app/face-finish.css, MarkerFace) and the export (svg-render-face-finish.ts), so the two agree.

/** A rectangle's corner within this of half its short side is a pill's (or a circle's) end, not a corner. */
export const FACE_PILL_SLACK_PX = 0.5;

/** Whether a rectangle with corner `rx` is a pill or a disc (its ends round), which keeps its shape in every finish. */
export function isPillRect(width: number, height: number, rx: number): boolean {
  if (!(rx > 0) || !(width > 0) || !(height > 0)) return false;
  return rx >= Math.min(width, height) / 2 - FACE_PILL_SLACK_PX;
}

/** The double-quoted attributes of one tag's attribute text, by name. */
export function faceAttrs(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]!] = m[2]!;
  return out;
}
