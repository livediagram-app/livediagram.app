// The styles, numbering, settings and footer parts of a written Word document
// (docs/specs/020-import-export/blueprints/office-export.md "Word styles"): the article's look set on Word's own
// styles (Normal, Title, Subtitle, Heading 1 to 3, Quote, Code, List Paragraph, Hyperlink), so a heading restyled in
// Word restyles every heading; and the bullet and numbered list definitions. Pure string building.

import { xmlText, XML_DECL } from './ooxml';
import type { DocxLook } from './docx-types';

export const WML_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
  ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const WML = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
export const DOCX_TYPES = {
  document: `${WML}.document.main+xml`,
  styles: `${WML}.styles+xml`,
  numbering: `${WML}.numbering+xml`,
  settings: `${WML}.settings+xml`,
  footer: `${WML}.footer+xml`,
} as const;

/** Twips (twentieths of a point) per page px: 96 px an inch, 1440 twips an inch. */
export const TWIPS_PER_PX = 15;
/** Word sizes text in half-points: 0.75 pt a px. */
const HALF_POINTS_PER_PX = 1.5;

// The article's type (docs/specs/007-editor/article-pages.md "Type") at Normal size: px, bold, space before and after
// in lines of the style's own leading.
type TypeRow = { px: number; bold: boolean; before: number; after: number };
const TYPE: Readonly<
  Record<'title' | 'subtitle' | 'h1' | 'h2' | 'h3' | 'quote' | 'code', TypeRow>
> = {
  title: { px: 36, bold: true, before: 0, after: 0.5 },
  subtitle: { px: 20, bold: false, before: 0, after: 1 },
  h1: { px: 28, bold: true, before: 1.2, after: 0.4 },
  h2: { px: 22, bold: true, before: 1, after: 0.3 },
  h3: { px: 18, bold: true, before: 0.8, after: 0.2 },
  quote: { px: 18, bold: false, before: 0.5, after: 0.75 },
  code: { px: 14, bold: false, before: 0.5, after: 0.75 },
};
const NORMAL_PX = 16;

// Word's style ids for each paragraph style, and the names Word and Google Docs recognise them by.
export const PARAGRAPH_STYLE_ID = {
  body: 'Normal',
  title: 'Title',
  subtitle: 'Subtitle',
  h1: 'Heading1',
  h2: 'Heading2',
  h3: 'Heading3',
  quote: 'Quote',
} as const;
export const CODE_STYLE_ID = 'Code';
export const CODE_CHAR_STYLE_ID = 'CodeChar';
export const LIST_STYLE_ID = 'ListParagraph';
export const HYPERLINK_STYLE_ID = 'Hyperlink';

// The list definitions: bullets by level (•, ◦, ▪, again), numbers by level (1, a, i, again), 28 px a level.
export const BULLET_NUM_ID = 1;
export const LIST_LEVELS = 5;
const LEVEL_STEP_PX = 28;
const HANGING_PX = 20;
const BULLETS = ['•', '◦', '▪'];
const NUMBER_FORMATS = ['decimal', 'lowerLetter', 'lowerRoman'];

const twips = (px: number) => Math.round(px * TWIPS_PER_PX);
const halfPoints = (px: number) => Math.max(2, Math.round(px * HALF_POINTS_PER_PX));
/** A line height as an at-least rule: never clips a taller run, as the page's leading never does. */
const leading = (px: number, lineHeight: number) =>
  `w:line="${twips(px * lineHeight)}" w:lineRule="atLeast"`;

const fonts = (face: string) =>
  `<w:rFonts w:ascii="${xmlText(face)}" w:hAnsi="${xmlText(face)}" w:cs="${xmlText(face)}" w:eastAsia="${xmlText(face)}"/>`;

/** A rule under a paragraph, in the accent. */
export const ruleUnder = (hex: string, size = 6) =>
  `<w:pBdr><w:bottom w:val="single" w:sz="${size}" w:space="4" w:color="${hex}"/></w:pBdr>`;

function paragraphStyle(
  id: string,
  name: string,
  look: DocxLook,
  row: TypeRow,
  opts: {
    outline?: number;
    colour?: string;
    italic?: boolean;
    face?: string;
    rule?: boolean;
    border?: string;
    indent?: string;
    keepNext?: boolean;
  } = {},
): string {
  const scale = look.bodyPx / NORMAL_PX;
  const px = row.px * scale;
  const line = px * look.lineHeight;
  // In the schema's order: keepNext, pBdr, spacing, ind, outlineLvl.
  const pPr =
    `<w:pPr>${opts.keepNext === false ? '' : '<w:keepNext/>'}${opts.rule ? ruleUnder(look.accent) : (opts.border ?? '')}` +
    `<w:spacing w:before="${twips(row.before * line)}" w:after="${twips(row.after * line)}" ${leading(px, look.lineHeight)}/>` +
    `${opts.indent ?? ''}` +
    `${opts.outline !== undefined ? `<w:outlineLvl w:val="${opts.outline}"/>` : ''}</w:pPr>`;
  const rPr =
    `<w:rPr>${fonts(opts.face ?? look.headingFont)}${row.bold ? '<w:b/><w:bCs/>' : ''}${opts.italic ? '<w:i/><w:iCs/>' : ''}` +
    `<w:color w:val="${opts.colour ?? look.ink}"/><w:sz w:val="${halfPoints(px)}"/><w:szCs w:val="${halfPoints(px)}"/></w:rPr>`;
  return `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>${pPr}${rPr}</w:style>`;
}

/** `word/styles.xml`. */
export function stylesXml(look: DocxLook): string {
  const body = look.bodyPx;
  const heading = look.accentHeadings ? look.accent : look.ink;
  const headingsRuled = look.rules === 'headings';
  const after = twips(look.paragraphSpace * body * look.lineHeight);
  const code = TYPE.code;
  const codeLine = code.px * (body / NORMAL_PX) * look.lineHeight;
  return (
    `${XML_DECL}<w:styles ${WML_NS}>` +
    `<w:docDefaults><w:rPrDefault><w:rPr>${fonts(look.bodyFont)}<w:color w:val="${look.ink}"/>` +
    `<w:sz w:val="${halfPoints(body)}"/><w:szCs w:val="${halfPoints(body)}"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="${after}" ${leading(body, look.lineHeight)}/></w:pPr></w:pPrDefault></w:docDefaults>` +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    paragraphStyle('Title', 'Title', look, TYPE.title, {
      colour: look.accentHeadings ? look.accent : look.ink,
      rule: look.rules !== 'none',
    }) +
    paragraphStyle('Subtitle', 'Subtitle', look, TYPE.subtitle, {
      colour: look.muted,
      face: look.bodyFont,
    }) +
    paragraphStyle('Heading1', 'heading 1', look, TYPE.h1, {
      outline: 0,
      colour: heading,
      rule: headingsRuled,
    }) +
    paragraphStyle('Heading2', 'heading 2', look, TYPE.h2, {
      outline: 1,
      colour: heading,
      rule: headingsRuled,
    }) +
    paragraphStyle('Heading3', 'heading 3', look, TYPE.h3, {
      outline: 2,
      colour: heading,
      rule: headingsRuled,
    }) +
    paragraphStyle('Quote', 'Quote', look, TYPE.quote, {
      italic: true,
      face: look.bodyFont,
      keepNext: false,
      border: `<w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="${look.accent}"/></w:pBdr>`,
      indent: `<w:ind w:left="${twips(16)}"/>`,
    }) +
    `<w:style w:type="paragraph" w:styleId="${CODE_STYLE_ID}"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:qFormat/>` +
    `<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>` +
    `<w:spacing w:before="${twips(code.before * codeLine)}" w:after="${twips(code.after * codeLine)}" ${leading(code.px * (body / NORMAL_PX), look.lineHeight)}/>` +
    `<w:ind w:left="${twips(8)}" w:right="${twips(8)}"/></w:pPr>` +
    `<w:rPr>${fonts(look.codeFont)}<w:sz w:val="${halfPoints(code.px * (body / NORMAL_PX))}"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="${LIST_STYLE_ID}"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/>` +
    '<w:pPr><w:spacing w:after="0"/><w:contextualSpacing/></w:pPr></w:style>' +
    '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>' +
    `<w:style w:type="character" w:styleId="${HYPERLINK_STYLE_ID}"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/>` +
    `<w:rPr><w:color w:val="${look.accent}"/><w:u w:val="single"/></w:rPr></w:style>` +
    `<w:style w:type="character" w:styleId="${CODE_CHAR_STYLE_ID}"><w:name w:val="Code Char"/><w:basedOn w:val="DefaultParagraphFont"/>` +
    `<w:rPr>${fonts(look.codeFont)}<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:rPr></w:style>` +
    '</w:styles>'
  );
}

function levelXml(ilvl: number, format: string, text: string, look: DocxLook): string {
  const left = twips(HANGING_PX + LEVEL_STEP_PX * ilvl + HANGING_PX);
  const marker = format === 'bullet' ? `<w:rPr><w:color w:val="${look.accent}"/></w:rPr>` : '';
  return (
    `<w:lvl w:ilvl="${ilvl}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${xmlText(text)}"/>` +
    `<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${left}" w:hanging="${twips(HANGING_PX)}"/></w:pPr>${marker}</w:lvl>`
  );
}

/** `word/numbering.xml`: abstract 0 the bullets, abstract 1 the numbers; num 1 every bullet, and one num per run of
 *  numbered items (`numberedRuns`), each restarting at 1. */
export function numberingXml(look: DocxLook, numberedRuns: number): string {
  const levels = (fmt: (l: number) => [string, string]) =>
    Array.from({ length: LIST_LEVELS }, (_, l) => levelXml(l, ...fmt(l), look)).join('');
  const bullets = levels((l) => ['bullet', BULLETS[l % BULLETS.length]!]);
  const numbers = levels((l) => [NUMBER_FORMATS[l % NUMBER_FORMATS.length]!, `%${l + 1}.`]);
  const restart = Array.from(
    { length: LIST_LEVELS },
    (_, l) => `<w:lvlOverride w:ilvl="${l}"><w:startOverride w:val="1"/></w:lvlOverride>`,
  ).join('');
  const runs = Array.from(
    { length: numberedRuns },
    (_, i) =>
      `<w:num w:numId="${BULLET_NUM_ID + 1 + i}"><w:abstractNumId w:val="1"/>${restart}</w:num>`,
  ).join('');
  return (
    `${XML_DECL}<w:numbering ${WML_NS}>` +
    `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="multilevel"/>${bullets}</w:abstractNum>` +
    `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="multilevel"/>${numbers}</w:abstractNum>` +
    `<w:num w:numId="${BULLET_NUM_ID}"><w:abstractNumId w:val="0"/></w:num>${runs}</w:numbering>`
  );
}

export const SETTINGS_XML =
  `${XML_DECL}<w:settings ${WML_NS}><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/>` +
  '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
  '</w:settings>';

/** The footer of a document with page numbers: the page number field, centred, small and muted. */
export function footerXml(look: DocxLook): string {
  const rPr = `<w:rPr><w:color w:val="${look.muted}"/><w:sz w:val="${halfPoints(look.bodyPx * 0.8)}"/></w:rPr>`;
  return (
    `${XML_DECL}<w:ftr ${WML_NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
    `<w:r>${rPr}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${rPr}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>` +
    `<w:r>${rPr}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${rPr}<w:t>1</w:t></w:r>` +
    `<w:r>${rPr}<w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`
  );
}
