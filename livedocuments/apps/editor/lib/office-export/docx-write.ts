// An article written as a `.docx` (docs/specs/020-import-export/blueprints/office-export.md "writeDocx"): the body,
// its styles and numbering, the settings, a footer with the page number when the article shows them, and the page
// setup. Pure: the article's zones are already images.

import {
  APP_PROPS_TYPE,
  appPropsXml,
  CORE_PROPS_TYPE,
  corePropsXml,
  REL,
  relsXml,
  writeOoxmlPackage,
  XML_DECL,
  type OoxmlPart,
  type OoxmlRel,
} from './ooxml';
import { docxBody } from './docx-body';
import {
  bandXml,
  DOCX_TYPES,
  numberingXml,
  SETTINGS_XML,
  stylesXml,
  TWIPS_PER_PX,
} from './docx-styles';
import type { DocxDocument } from './docx-types';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const BODY_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
  ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
  ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';

const tw = (px: number) => Math.round(px * TWIPS_PER_PX);

// The header and footer parts a document carries, by their relationship ids: the default ones, and the empty first-page
// ones Different First Page adds.
type BandRefs = { header?: string; footer?: string; firstHeader?: string; firstFooter?: string };

function sectionXml(doc: DocxDocument, refs: BandRefs): string {
  const p = doc.page;
  const ref = (kind: 'header' | 'footer', type: string, rid: string | undefined) =>
    rid ? `<w:${kind}Reference w:type="${type}" r:id="${rid}"/>` : '';
  const references =
    ref('header', 'default', refs.header) +
    ref('header', 'first', refs.firstHeader) +
    ref('footer', 'default', refs.footer) +
    ref('footer', 'first', refs.firstFooter);
  const titlePg = refs.firstHeader || refs.firstFooter ? '<w:titlePg/>' : '';
  return (
    `<w:sectPr>${references}<w:pgSz w:w="${tw(p.widthPx)}" w:h="${tw(p.heightPx)}"${p.landscape ? ' w:orient="landscape"' : ''}/>` +
    `<w:pgMar w:top="${tw(p.topMarginPx)}" w:right="${tw(p.marginPx)}" w:bottom="${tw(p.marginPx)}" w:left="${tw(p.marginPx)}"` +
    ` w:header="${tw(p.marginPx / 2)}" w:footer="${tw(p.marginPx / 2)}" w:gutter="0"/><w:cols w:space="720"/>${titlePg}</w:sectPr>`
  );
}

/** The document's bytes. */
export function writeDocx(doc: DocxDocument, when: Date = new Date()): Uint8Array<ArrayBuffer> {
  // The document's own relationships first: styles, numbering, settings, then its footer; links and images after.
  const fixed: OoxmlRel[] = [
    { id: 'rId1', type: REL.styles, target: 'styles.xml' },
    { id: 'rId2', type: REL.numbering, target: 'numbering.xml' },
    { id: 'rId3', type: REL.settings, target: 'settings.xml' },
  ];
  // The header and footer (docs/specs/007-editor/article-pages.md "Headers and footers"): the footer's centre is the
  // page number while the footer has none of its own and the article shows page numbers.
  const bands = doc.bands;
  const header = bands?.header;
  const footerCenter = bands?.footer?.center ?? (doc.look.pageNumbers ? '{page}' : undefined);
  const footer =
    bands?.footer || footerCenter
      ? { ...bands?.footer, ...(footerCenter ? { center: footerCenter } : {}) }
      : undefined;
  const textWidthPx = doc.page.widthPx - 2 * doc.page.marginPx;
  const values = { name: bands?.name ?? doc.title, date: bands?.date ?? '' };
  const bandParts: OoxmlPart[] = [];
  const refs: BandRefs = {};
  const addBand = (
    key: keyof BandRefs,
    kind: 'header' | 'footer',
    file: string,
    band: typeof header,
  ) => {
    const id = `rId${fixed.length + 1}`;
    fixed.push({ id, type: REL[kind], target: file });
    refs[key] = id;
    bandParts.push({
      path: `word/${file}`,
      xml: bandXml(kind, band, doc.look, textWidthPx, values),
      type: DOCX_TYPES[kind],
    });
  };
  if (header) addBand('header', 'header', 'header1.xml', header);
  if (footer) addBand('footer', 'footer', 'footer1.xml', footer);
  if (bands?.differentFirstPage && (header || footer)) {
    if (header) addBand('firstHeader', 'header', 'header2.xml', undefined);
    if (footer) addBand('firstFooter', 'footer', 'footer2.xml', undefined);
  }
  const body = docxBody(doc.blocks, doc.look, fixed.length + 1, textWidthPx);
  // A body must end on a paragraph before its section, so an empty article is one empty paragraph.
  const content = body.xml || '<w:p/>';
  const documentXml = `${XML_DECL}<w:document ${BODY_NS}><w:body>${content}${sectionXml(doc, refs)}</w:body></w:document>`;

  const parts: OoxmlPart[] = [
    {
      path: '_rels/.rels',
      xml: relsXml([
        { id: 'rId1', type: REL.officeDocument, target: 'word/document.xml' },
        { id: 'rId2', type: REL.coreProps, target: 'docProps/core.xml' },
        { id: 'rId3', type: REL.extendedProps, target: 'docProps/app.xml' },
      ]),
    },
    { path: 'docProps/core.xml', xml: corePropsXml(doc.title, when), type: CORE_PROPS_TYPE },
    { path: 'docProps/app.xml', xml: appPropsXml(), type: APP_PROPS_TYPE },
    { path: 'word/document.xml', xml: documentXml, type: DOCX_TYPES.document },
    { path: 'word/_rels/document.xml.rels', xml: relsXml([...fixed, ...body.rels]) },
    { path: 'word/styles.xml', xml: stylesXml(doc.look), type: DOCX_TYPES.styles },
    {
      path: 'word/numbering.xml',
      xml: numberingXml(doc.look, body.numberedRuns),
      type: DOCX_TYPES.numbering,
    },
    { path: 'word/settings.xml', xml: SETTINGS_XML, type: DOCX_TYPES.settings },
  ];
  parts.push(...bandParts);
  for (const m of body.media) parts.push({ path: `word/media/${m.name}`, bytes: m.png });
  return writeOoxmlPackage(parts, when);
}
