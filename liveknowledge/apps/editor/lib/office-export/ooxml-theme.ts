// The one DrawingML theme a written deck carries (docs/specs/020-import-export/blueprints/office-export.md "The
// fixed parts"): Office's own colours, the deck's faces as its major and minor fonts (Calibri for a deck with none),
// and the three fill, line, effect and background styles the schema asks for. Nothing styles content, since every
// shape the export writes names its own colours and faces. Pure.

import { XML_DECL, xmlText } from './ooxml';
import { pitchFamilyOf } from './ooxml-fonts';
import type { PptxDeck } from './pptx-types';

const SYS = (name: string, last: string) => `<a:sysClr val="${name}" lastClr="${last}"/>`;
const RGB = (hex: string) => `<a:srgbClr val="${hex}"/>`;
const PH = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';

export const THEME_TYPE = 'application/vnd.openxmlformats-officedocument.theme+xml';

/** The theme's two latin faces: the minor (body) font and the major (heading) font. */
export type ThemeFonts = { major: string; minor: string };

export const DEFAULT_THEME_FONT = 'Calibri';

/** The deck's faces as its theme names them: the minor is the face with the most characters, the major the face with
 *  the most characters in the largest text (a tie goes to the face met first); Calibri for a deck naming none
 *  (docs/specs/020-import-export/office-export.md "Fonts are named, never embedded"). One pass over the runs. */
export function themeFontsOf(deck: PptxDeck): ThemeFonts {
  const total = new Map<string, number>();
  let largest = 0;
  let atLargest = new Map<string, number>();
  for (const slide of deck.slides) {
    for (const item of slide.items) {
      if (item.kind !== 'shape' || !item.body) continue;
      for (const para of item.body.paragraphs) {
        for (const run of para.runs) {
          if (!run.font || run.text === '') continue;
          const n = run.text.length;
          total.set(run.font, (total.get(run.font) ?? 0) + n);
          if (run.sizePt > largest) {
            largest = run.sizePt;
            atLargest = new Map();
          }
          if (run.sizePt === largest) atLargest.set(run.font, (atLargest.get(run.font) ?? 0) + n);
        }
      }
    }
  }
  const top = (m: Map<string, number>): string => {
    let best = DEFAULT_THEME_FONT;
    let most = 0;
    for (const [face, n] of m)
      if (n > most) {
        best = face;
        most = n;
      }
    return best;
  };
  return { major: top(atLargest), minor: top(total) };
}

// A face named with its pitch and family, as a run names it, so an app without it picks a close stand-in.
const latin = (face: string): string =>
  face === DEFAULT_THEME_FONT
    ? `<a:latin typeface="${DEFAULT_THEME_FONT}"/>`
    : `<a:latin typeface="${xmlText(face)}" pitchFamily="${pitchFamilyOf(face)}" charset="0"/>`;

/** The theme part (`ppt/theme/theme1.xml` and the notes master's `theme2.xml`). */
export const themeXml = (fonts: ThemeFonts): string =>
  `${XML_DECL}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="liveknowledge">` +
  '<a:themeElements>' +
  '<a:clrScheme name="liveknowledge">' +
  `<a:dk1>${SYS('windowText', '000000')}</a:dk1><a:lt1>${SYS('window', 'FFFFFF')}</a:lt1>` +
  `<a:dk2>${RGB('1E293B')}</a:dk2><a:lt2>${RGB('F1F5F9')}</a:lt2>` +
  `<a:accent1>${RGB('D97706')}</a:accent1><a:accent2>${RGB('2563EB')}</a:accent2>` +
  `<a:accent3>${RGB('16A34A')}</a:accent3><a:accent4>${RGB('DC2626')}</a:accent4>` +
  `<a:accent5>${RGB('7C3AED')}</a:accent5><a:accent6>${RGB('0891B2')}</a:accent6>` +
  `<a:hlink>${RGB('2563EB')}</a:hlink><a:folHlink>${RGB('7C3AED')}</a:folHlink>` +
  '</a:clrScheme>' +
  '<a:fontScheme name="liveknowledge">' +
  `<a:majorFont>${latin(fonts.major)}<a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
  `<a:minorFont>${latin(fonts.minor)}<a:ea typeface=""/><a:cs typeface=""/></a:minorFont>` +
  '</a:fontScheme>' +
  '<a:fmtScheme name="liveknowledge">' +
  `<a:fillStyleLst>${PH}${PH}${PH}</a:fillStyleLst>` +
  '<a:lnStyleLst>' +
  [6350, 12700, 19050]
    .map(
      (w) =>
        `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr">${PH}<a:prstDash val="solid"/></a:ln>`,
    )
    .join('') +
  '</a:lnStyleLst>' +
  '<a:effectStyleLst>' +
  '<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3) +
  '</a:effectStyleLst>' +
  `<a:bgFillStyleLst>${PH}${PH}${PH}</a:bgFillStyleLst>` +
  '</a:fmtScheme>' +
  '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';
