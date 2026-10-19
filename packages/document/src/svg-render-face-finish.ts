// A face's own parts in its element's finish, in the export (docs/specs/008-canvas/finish.md "Faces"): what the
// canvas does with app/face-finish.css and MarkerFace, done to the face's markup. Markup is rewritten by tag, never
// parsed, as svgSketchFace does: a face is our own renderers' output, its attributes always double-quoted.
import { faceAttrs, isPillRect } from './face-finish';

const RECT = /<rect\b([^>]*?)(\/?)>/g;
const THICK_LINE = /(<(?:rect|circle|ellipse|path|line|polyline|polygon)\b[^>]*?\sstroke-width=")2(")/g;

/** Professional: every rectangle square (a circle's or a pill's ends kept), every 2 px line 1 px. */
export function svgProfessionalFace(markup: string): string {
  return markup
    .replace(RECT, (tag, attrs: string, close: string) => {
      const a = faceAttrs(attrs);
      if (!a.rx && !a.ry) return tag;
      if (a['data-finish-keep'] !== undefined) return tag;
      if (isPillRect(Number(a.width), Number(a.height), Number(a.rx ?? a.ry))) return tag;
      return `<rect${attrs.replace(/\s(rx|ry)="[^"]*"/g, '')}${close}>`;
    })
    .replace(THICK_LINE, '$11$2');
}
