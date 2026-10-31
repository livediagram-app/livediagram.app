// One slide's XML, and its notes slide's (docs/specs/020-import-export/blueprints/office-export.md "writePptx"):
// the background, then each item in paint order as a `p:sp` (a text box or a preset shape with its text) or a
// `p:pic`. Pure string building over a slide already in the file's units.

import { xmlText, XML_DECL } from './ooxml';
import { solidFillXml } from './ooxml-colour';
import type {
  EmuRect,
  PptxBackground,
  PptxItem,
  PptxParagraph,
  PptxRun,
  PptxShape,
  PptxSlide,
  PptxTextBody,
} from './pptx-types';

export const PML_NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
  ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
  ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

// A DrawingML angle is 60,000ths of a degree, clockwise.
const ROT_UNIT = 60_000;

const int = (v: number) => Math.round(v);

/** An empty shape tree's group properties, every tree's first child. */
export const SP_TREE_HEAD =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

function xfrmXml(box: EmuRect, rotation = 0): string {
  const rot = ((rotation % 360) + 360) % 360;
  const r = rot ? ` rot="${int(rot * ROT_UNIT)}"` : '';
  return `<a:xfrm${r}><a:off x="${int(box.x)}" y="${int(box.y)}"/><a:ext cx="${Math.max(1, int(box.cx))}" cy="${Math.max(1, int(box.cy))}"/></a:xfrm>`;
}

function runXml(run: PptxRun): string {
  const attrs =
    ` lang="en-US" sz="${int(run.sizePt * 100)}"` +
    (run.bold ? ' b="1"' : ' b="0"') +
    (run.italic ? ' i="1"' : '') +
    (run.underline ? ' u="sng"' : '') +
    (run.strike ? ' strike="sngStrike"' : '') +
    ' dirty="0"';
  const fill = run.colour ? solidFillXml(run.colour) : '';
  const font = run.font
    ? `<a:latin typeface="${xmlText(run.font)}"/><a:cs typeface="${xmlText(run.font)}"/>`
    : '';
  return `<a:r><a:rPr${attrs}>${fill}${font}</a:rPr><a:t>${xmlText(run.text)}</a:t></a:r>`;
}

function paragraphXml(p: PptxParagraph): string {
  const spacing = `<a:lnSpc><a:spcPts val="${int(p.lineHeightPt * 100)}"/></a:lnSpc>`;
  const runs = p.runs.filter((r) => r.text.length > 0);
  // An empty line keeps its height through the paragraph's end mark.
  const end = p.runs[0]
    ? `<a:endParaRPr lang="en-US" sz="${int(p.runs[0].sizePt * 100)}" dirty="0"/>`
    : '';
  return `<a:p><a:pPr algn="${p.align}">${spacing}</a:pPr>${runs.map(runXml).join('')}${end}</a:p>`;
}

/** A text body: its insets and anchor, never autofitted (the box is the element's), then its paragraphs. */
export function textBodyXml(body: PptxTextBody | null): string {
  if (!body || body.paragraphs.length === 0)
    return '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p></p:txBody>';
  const [l, t, r, b] = body.insets.map(int);
  return (
    `<p:txBody><a:bodyPr wrap="square" lIns="${l}" tIns="${t}" rIns="${r}" bIns="${b}" rtlCol="0" anchor="${body.anchor}">` +
    '<a:noAutofit/></a:bodyPr><a:lstStyle/>' +
    body.paragraphs.map(paragraphXml).join('') +
    '</p:txBody>'
  );
}

/**
 * An SVG path in a 0..100 box (absolute M, L, C and Z, the commands the shape table's outlines use) as DrawingML
 * path commands in the shape's own EMU, so a renderer that ignores a path's own coordinate space still draws it at
 * the shape's size. Null when the path holds anything else.
 */
export function outlinePathXml(d: string, cx: number, cy: number): string | null {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const pt = (x: string, y: string) =>
    `<a:pt x="${int((Number(x) * cx) / 100)}" y="${int((Number(y) * cy) / 100)}"/>`;
  let out = '';
  for (let i = 0; i < tokens.length;) {
    const cmd = tokens[i++];
    const take = (n: number) => {
      const args = tokens.slice(i, i + n);
      i += n;
      return args.length === n && args.every((a) => /\d/.test(a)) ? args : null;
    };
    if (cmd === 'Z' || cmd === 'z') {
      out += '<a:close/>';
      continue;
    }
    const n = cmd === 'M' || cmd === 'L' ? 2 : cmd === 'C' ? 6 : -1;
    if (n < 0) return null;
    const a = take(n);
    if (!a) return null;
    if (cmd === 'M') out += `<a:moveTo>${pt(a[0]!, a[1]!)}</a:moveTo>`;
    else if (cmd === 'L') out += `<a:lnTo>${pt(a[0]!, a[1]!)}</a:lnTo>`;
    else
      out += `<a:cubicBezTo>${pt(a[0]!, a[1]!)}${pt(a[2]!, a[3]!)}${pt(a[4]!, a[5]!)}</a:cubicBezTo>`;
  }
  return out || null;
}

/** A shape's geometry: a preset with its adjust, or its custom outline. */
function geometryXml(s: PptxShape): string {
  const path = s.outline ? outlinePathXml(s.outline, s.box.cx, s.box.cy) : null;
  if (path) {
    const cx = Math.max(1, int(s.box.cx));
    const cy = Math.max(1, int(s.box.cy));
    return (
      '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/>' +
      `<a:pathLst><a:path w="${cx}" h="${cy}">${path}</a:path></a:pathLst></a:custGeom>`
    );
  }
  const av = s.adjust !== undefined ? `<a:gd name="adj" fmla="val ${int(s.adjust)}"/>` : '';
  return `<a:prstGeom prst="${s.geometry}"><a:avLst>${av}</a:avLst></a:prstGeom>`;
}

function shapeXml(s: PptxShape, id: number): string {
  const nv = `<p:nvSpPr><p:cNvPr id="${id}" name="${xmlText(s.name)}"/><p:cNvSpPr${s.txBox ? ' txBox="1"' : ''}/><p:nvPr/></p:nvSpPr>`;
  const fill = s.fill ? solidFillXml(s.fill) : '<a:noFill/>';
  const line = s.line
    ? `<a:ln w="${int(s.line.widthEmu)}">${solidFillXml(s.line.colour)}${s.line.dash ? `<a:prstDash val="${s.line.dash}"/>` : ''}</a:ln>`
    : '<a:ln><a:noFill/></a:ln>';
  return (
    `<p:sp>${nv}<p:spPr>${xfrmXml(s.box, s.rotation)}${geometryXml(s)}` +
    `${fill}${line}</p:spPr>${textBodyXml(s.body)}</p:sp>`
  );
}

function pictureXml(name: string, box: EmuRect, id: number, rId: string): string {
  return (
    `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${xmlText(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr>${xfrmXml(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
  );
}

function backgroundXml(bg: PptxBackground | null, rId: string | undefined): string {
  if (!bg) return '';
  const fill =
    bg.kind === 'solid'
      ? solidFillXml(bg.colour)
      : `<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${rId}"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></a:blipFill>`;
  return `<p:bg><p:bgPr>${fill}<a:effectLst/></p:bgPr></p:bg>`;
}

/**
 * The slide's XML. `pictureRid` names each picture item's image relationship by its place among the slide's items,
 * and `backgroundRid` the background picture's.
 */
export function slideXml(
  slide: PptxSlide,
  pictureRid: (itemIndex: number) => string,
  backgroundRid?: string,
): string {
  // Shape ids are the slide's own: 1 is the tree, the items count from 2.
  const items = slide.items.map((item: PptxItem, i) =>
    item.kind === 'picture'
      ? pictureXml(item.name, item.box, i + 2, pictureRid(i))
      : shapeXml(item, i + 2),
  );
  return (
    `${XML_DECL}<p:sld ${PML_NS}${slide.hidden ? ' show="0"' : ''}><p:cSld>${backgroundXml(slide.background, backgroundRid)}` +
    `<p:spTree>${SP_TREE_HEAD}${items.join('')}</p:spTree></p:cSld>` +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
  );
}

/** A slide's notes: the slide image and the notes body placeholders, the notes a paragraph a line. */
export function notesSlideXml(notes: string): string {
  const paragraphs = notes
    .split(/\r\n|\r|\n/)
    .map((line) =>
      line
        ? `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${xmlText(line)}</a:t></a:r></a:p>`
        : '<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>',
    )
    .join('');
  return (
    `${XML_DECL}<p:notes ${PML_NS}><p:cSld><p:spTree>${SP_TREE_HEAD}` +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr>' +
    '<p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
    '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>' +
    `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>` +
    '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>'
  );
}
