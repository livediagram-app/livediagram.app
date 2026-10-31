// Word, Google Docs, PowerPoint and Google Slides packages built at test time
// (docs/specs/020-import-export/blueprints/office-import.md "Assets and external resources"): a zip writer and small
// builders whose XML mimics what each app writes, so no binary fixture is committed. Imported by tests only.
//
// The differences each flavour covers, as those apps write them:
// - Word: `<w:b/>` toggles, style ids with names ("Heading1" named "heading 1"), list paragraphs with numbering,
//   "HTML Preformatted" code, `w:pageBreakBefore`, field-code hyperlinks, tracked changes, footnotes, comments,
//   headers, charts, inline pictures.
// - Google Docs: `<w:b w:val="1"/>` toggles, code as runs in Courier New / Roboto Mono, page breaks as
//   `<w:br w:type="page"/>` runs, floating (`wp:anchor`) pictures, relationship hyperlinks.
// - PowerPoint: placeholders with no box of their own (taken from the layout, then the master), sizes from the
//   master's text styles, bullets by default in a body, groups, tables, connectors, video, hidden slides, notes.
// - Google Slides: a 10 x 5.625 inch slide, every shape with its own box and explicit bullets, notes.

const enc = new TextEncoder();

let CRC_TABLE: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export type ZipInput = Record<string, string | Uint8Array>;

/** A zip of `files`, deflated unless `store` is set (both methods occur in real packages). */
export async function makeZip(
  files: ZipInput,
  opts: { store?: boolean } = {},
): Promise<Uint8Array> {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = typeof content === 'string' ? enc.encode(content) : content;
    const data = opts.store ? raw : await deflateRaw(raw);
    const method = opts.store ? 0 : 8;
    const nameBytes = enc.encode(name);
    const crc = crc32(raw);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x800, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x800, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + 22);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A 1 x 1 PNG. */
export const TINY_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = (type: string) => `${NS_R}/${type}`;
const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const NS_PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';

type Rel = { id: string; type: string; target: string; external?: boolean };

export function relsXml(rels: readonly Rel[]): string {
  return `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels
    .map(
      (r) =>
        `<Relationship Id="${r.id}" Type="${REL(r.type)}" Target="${r.target}"${r.external ? ' TargetMode="External"' : ''}/>`,
    )
    .join('')}</Relationships>`;
}

function contentTypes(overrides: Record<string, string>): string {
  return `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>${Object.entries(
    overrides,
  )
    .map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`)
    .join('')}</Types>`;
}

// --- Word -----------------------------------------------------------------------------------------------------------

export const DOCX_MAIN =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';

const WORD_STYLES = `${XML}<w:styles xmlns:w="${NS_W}">
<w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/></w:style>
<w:style w:type="paragraph" w:styleId="HTMLPreformatted"><w:name w:val="HTML Preformatted"/></w:style>
<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:pPr><w:numPr><w:numId w:val="1"/></w:numPr></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="MyHeading"><w:name w:val="My Heading"/><w:basedOn w:val="Heading2"/></w:style>
<w:style w:type="character" w:styleId="Strong"><w:name w:val="Strong"/><w:rPr><w:b/></w:rPr></w:style>
<w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Code Char"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr></w:style>
</w:styles>`;

const WORD_NUMBERING = `${XML}<w:numbering xmlns:w="${NS_W}">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:numFmt w:val="none"/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
<w:num w:numId="3"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>`;

export type DocxOptions = {
  /** The inside of `w:body`. */
  body: string;
  styles?: string | null;
  numbering?: string | null;
  /** Relationships of the document part beyond styles and numbering. */
  rels?: Rel[];
  media?: Record<string, Uint8Array>;
  /** The prefix the document part uses for the main namespace (Word writes `w`). */
  prefix?: string;
  store?: boolean;
  /** Overrides the main part's content type. */
  mainType?: string;
};

/** A Word package around a body. */
export async function makeDocx(opts: DocxOptions): Promise<Uint8Array> {
  const prefix = opts.prefix ?? 'w';
  const body =
    prefix === 'w'
      ? opts.body
      : opts.body.replace(/(<\/?)w:/g, `$1${prefix}:`).replace(/ w:/g, ` ${prefix}:`);
  const doc = `${XML}<${prefix}:document xmlns:${prefix}="${NS_W}" xmlns:r="${NS_R}" xmlns:wp="${NS_WP}" xmlns:a="${NS_A}" xmlns:pic="${NS_PIC}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml"><${prefix}:body>${body}</${prefix}:body></${prefix}:document>`;
  const rels: Rel[] = [...(opts.rels ?? [])];
  const files: ZipInput = {
    '[Content_Types].xml': contentTypes({ '/word/document.xml': opts.mainType ?? DOCX_MAIN }),
    '_rels/.rels': relsXml([{ id: 'rId1', type: 'officeDocument', target: 'word/document.xml' }]),
    'word/document.xml': doc,
  };
  if (opts.styles !== null) {
    files['word/styles.xml'] = opts.styles ?? WORD_STYLES;
    rels.push({ id: 'rIdStyles', type: 'styles', target: 'styles.xml' });
  }
  if (opts.numbering !== null) {
    files['word/numbering.xml'] = opts.numbering ?? WORD_NUMBERING;
    rels.push({ id: 'rIdNumbering', type: 'numbering', target: 'numbering.xml' });
  }
  files['word/_rels/document.xml.rels'] = relsXml(rels);
  for (const [path, bytes] of Object.entries(opts.media ?? {})) files[path] = bytes;
  return makeZip(files, opts.store ? { store: true } : {});
}

export const p = (inner: string, pPr = '') =>
  `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${inner}</w:p>`;
export const r = (text: string, rPr = '') =>
  `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
export const styled = (style: string) => `<w:pStyle w:val="${style}"/>`;
export const numbered = (numId: number, level = 0) =>
  `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>`;

/** An inline (Word) or floating (Google) picture of `widthPx` x `heightPx`. */
export function drawing(
  rid: string,
  widthPx: number,
  heightPx: number,
  opts: { anchor?: boolean; alt?: string; link?: boolean } = {},
): string {
  const tag = opts.anchor ? 'wp:anchor' : 'wp:inline';
  const blip = opts.link ? `<a:blip r:link="${rid}"/>` : `<a:blip r:embed="${rid}"/>`;
  return `<w:r><w:drawing><${tag}><wp:extent cx="${widthPx * 9525}" cy="${heightPx * 9525}"/><wp:docPr id="1" name="Picture 1"${opts.alt ? ` descr="${opts.alt}"` : ''}/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill>${blip}</pic:blipFill></pic:pic></a:graphicData></a:graphic></${tag}></w:drawing></w:r>`;
}

export const chartDrawing = `<w:r><w:drawing><wp:inline><wp:extent cx="100" cy="100"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"/></a:graphic></wp:inline></w:drawing></w:r>`;

/** What Word writes for a short report: every mapping in the spec's table. */
export function wordSampleBody(): string {
  return [
    p(r('Quarterly Report'), styled('Title')),
    p(r('Prepared for the team'), styled('Subtitle')),
    p(r('Overview'), styled('Heading1')),
    p(
      [
        r('Plain, '),
        r('bold', '<w:b/>'),
        r(', '),
        r('italic', '<w:i/>'),
        r(', '),
        r('underlined', '<w:u w:val="single"/>'),
        r(', '),
        r('struck', '<w:strike/>'),
        r(', x'),
        r('2', '<w:vertAlign w:val="superscript"/>'),
        r(' and '),
        r('code', '<w:rStyle w:val="CodeChar"/>'),
        r('. See '),
        `<w:hyperlink r:id="rIdLink"><w:r><w:t>the site</w:t></w:r></w:hyperlink>`,
        r(' or '),
        `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> HYPERLINK "mailto:team@example.com" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${r('email us')}<w:r><w:fldChar w:fldCharType="end"/></w:r>`,
        r('.'),
        `<w:r><w:footnoteReference w:id="1"/></w:r>`,
        `<w:r><w:commentReference w:id="0"/></w:r>`,
      ].join(''),
      '<w:jc w:val="both"/>',
    ),
    p(r('First point'), numbered(1)),
    p(r('A detail'), numbered(1, 1)),
    p(r('From the style'), styled('ListBullet')),
    p(r('Step one'), numbered(2)),
    p(r('Not a list'), numbered(3)),
    p(r('Well said.'), styled('Quote')),
    p(r('const a = 1;'), styled('HTMLPreformatted')),
    p(r('const b = 2;'), styled('HTMLPreformatted')),
    p(''),
    p(
      `${r('Kept')}<w:del><w:r><w:delText>Gone</w:delText></w:r></w:del><w:ins>${r(' and added')}</w:ins>`,
    ),
    p(r('Details'), `${styled('Heading2')}<w:pageBreakBefore/>`),
    p(drawing('rIdImg', 640, 480, { alt: 'A chart of sales' })),
    `<w:tbl><w:tr><w:tc>${p(r('Name', '<w:b/>'))}</w:tc><w:tc>${p(r('Score'))}</w:tc></w:tr><w:tr><w:tc>${p(r('Ada'))}</w:tc><w:tc>${p(r('10'))}</w:tc></w:tr></w:tbl>`,
    p(chartDrawing),
    p(r('Deep heading'), styled('Heading4')),
    p(r('Centred'), '<w:jc w:val="center"/>'),
    `<w:sectPr><w:headerReference r:id="rIdHeader"/></w:sectPr>`,
  ].join('');
}

export function wordSampleDocx(): Promise<Uint8Array> {
  return makeDocx({
    body: wordSampleBody(),
    rels: [
      { id: 'rIdLink', type: 'hyperlink', target: 'https://example.com/', external: true },
      { id: 'rIdImg', type: 'image', target: 'media/image1.png' },
      { id: 'rIdHeader', type: 'header', target: 'header1.xml' },
    ],
    media: { 'word/media/image1.png': TINY_PNG },
  });
}

/** What a Google Docs download writes: valued toggles, code fonts, page-break runs, floating pictures. */
export function googleDocsSampleDocx(): Promise<Uint8Array> {
  const mono = '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>';
  const body = [
    p(r('Launch plan'), styled('Title')),
    p(r('Goals'), styled('Heading1')),
    p(`${r('Ship ', '<w:b w:val="1"/>')}${r('soon', '<w:b w:val="0"/>')}`),
    p(`<w:hyperlink r:id="kix.link" w:history="1">${r('Docs')}</w:hyperlink>`),
    p(r('npm run build', mono)),
    p(r('npm test', '<w:rFonts w:ascii="Roboto Mono" w:hAnsi="Roboto Mono"/>')),
    p(`${r('Before the break')}<w:r><w:br w:type="page"/></w:r>${r('After the break')}`),
    p(drawing('kix.img', 300, 200, { anchor: true })),
    p(r('Risks'), styled('Heading2')),
  ].join('');
  return makeDocx({
    body,
    rels: [
      { id: 'kix.link', type: 'hyperlink', target: 'https://docs.example.com/', external: true },
      { id: 'kix.img', type: 'image', target: 'media/image1.png' },
    ],
    media: { 'word/media/image1.png': TINY_PNG },
  });
}

// A seeded generator, so a long fixture is the same every run.
function seeded(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}

const WORDS =
  'the of and to in a is that for it as was with be by on not he this are or his from at which but have an they you were her she there been one all we their has would when if so no what up out who them some could into its then two more these now other time any only new like than may first people way over very'.split(
    ' ',
  );

/** `n` words of varied filler text. */
function words(rand: () => number, n: number): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(WORDS[Math.floor(rand() * WORDS.length)]!);
  return out.join(' ');
}

/** Incompressible bytes standing in for a photo of `kb` kilobytes. */
export function noiseBytes(rand: () => number, kb: number): Uint8Array {
  const out = new Uint8Array(kb * 1024);
  for (let i = 0; i < out.length; i++) out[i] = Math.floor(rand() * 256);
  return out;
}

// What Word writes round every run and paragraph: revision ids, fonts, sizes, language.
const WORD_RPR =
  '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-GB"/>';
const wordP = (inner: string, pPr = '') =>
  `<w:p w:rsidR="00A1B2C3" w:rsidRDefault="00D4E5F6" w:rsidP="00A1B2C3"><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/>${pPr}</w:pPr>${inner}</w:p>`;
const wordR = (text: string, extra = '') => r(text, `${extra}${WORD_RPR}`);

/** A long document as Word writes one: `pages` pages of headings, paragraphs of varied text in several runs, a
 *  list, and a 200 KB photo every 10 pages. */
export function longDocx(pages: number): Promise<Uint8Array> {
  const rand = seeded(pages);
  const parts: string[] = [];
  const media: Record<string, Uint8Array> = {};
  const rels: Rel[] = [];
  for (let page = 0; page < pages; page++) {
    parts.push(wordP(wordR(`Section ${page + 1}: ${words(rand, 4)}`), styled('Heading1')));
    for (let i = 0; i < 5; i++) {
      parts.push(
        wordP(
          `${wordR(`${words(rand, 30)} `)}${wordR(words(rand, 3), '<w:b/>')}${wordR(` ${words(rand, 35)}.`)}`,
        ),
      );
    }
    parts.push(
      wordP(wordR(words(rand, 8)), numbered(1)),
      wordP(wordR(words(rand, 10)), numbered(1)),
    );
    if (page % 10 === 0) {
      const n = page / 10 + 1;
      rels.push({ id: `rIdImg${n}`, type: 'image', target: `media/image${n}.jpeg` });
      media[`word/media/image${n}.jpeg`] = noiseBytes(rand, 200);
      parts.push(wordP(drawing(`rIdImg${n}`, 400, 300)));
    }
  }
  return makeDocx({ body: parts.join(''), rels, media });
}

// --- PowerPoint -----------------------------------------------------------------------------------------------------

export const PPTX_MAIN =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';

const nvSp = (id: number, name: string, ph?: string) =>
  `<p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr>${ph ?? ''}</p:nvPr></p:nvSpPr>`;
export const xfrm = (x: number, y: number, cx: number, cy: number) =>
  `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`;

/** A text shape: `box` its own `a:xfrm` (absent: inherited), `paras` its `a:p` elements. */
export function sp(opts: {
  id?: number;
  ph?: string;
  box?: string;
  paras: string;
  bodyPr?: string;
  lstStyle?: string;
}): string {
  return `<p:sp>${nvSp(opts.id ?? 2, 'Shape', opts.ph)}<p:spPr>${opts.box ?? ''}</p:spPr><p:txBody><a:bodyPr${opts.bodyPr ?? ''}/>${opts.lstStyle ? `<a:lstStyle>${opts.lstStyle}</a:lstStyle>` : '<a:lstStyle/>'}${opts.paras}</p:txBody></p:sp>`;
}
export const ap = (text: string, pPr = '', rPr = '') =>
  `<a:p>${pPr ? `<a:pPr${pPr.startsWith(' ') ? pPr : ''}>${pPr.startsWith(' ') ? '' : pPr}</a:pPr>` : ''}<a:r><a:rPr lang="en-GB"${rPr}/><a:t>${text}</a:t></a:r></a:p>`;

export function pic(
  rid: string,
  box: string,
  opts: { crop?: boolean; video?: boolean; alt?: string } = {},
): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="9" name="Picture"${opts.alt ? ` descr="${opts.alt}"` : ''}/><p:cNvPicPr/><p:nvPr>${opts.video ? '<a:videoFile r:link="rIdVideo"/>' : ''}</p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/>${opts.crop ? '<a:srcRect l="10000" r="5000"/>' : ''}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${box}</p:spPr></p:pic>`;
}

const slideXml = (tree: string, attrs = '') =>
  `${XML}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"${attrs}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${tree}</p:spTree></p:cSld></p:sld>`;

const layoutXml = (tree: string) =>
  `${XML}<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>${tree}</p:spTree></p:cSld></p:sldLayout>`;

const notesXml = (text: string) =>
  `${XML}<p:notes xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>${sp({ ph: '<p:ph type="sldImg"/>', paras: '<a:p/>' })}${sp(
    {
      ph: '<p:ph type="body" idx="1"/>',
      paras: text
        .split('\n')
        .map((l) => ap(l))
        .join(''),
    },
  )}</p:spTree></p:cSld></p:notes>`;

const MASTER = `${XML}<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>${sp(
  {
    id: 2,
    ph: '<p:ph type="title"/>',
    box: xfrm(838200, 365125, 10515600, 1325563),
    paras: ap('Click to edit Master title style'),
    bodyPr: ' anchor="ctr"',
  },
)}${sp({
  id: 3,
  ph: '<p:ph type="body" idx="1"/>',
  box: xfrm(838200, 1825625, 10515600, 4351338),
  paras: ap('Click to edit Master text styles'),
})}</p:spTree></p:cSld><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:buChar char="•"/><a:defRPr sz="2800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;

export type DeckSlide = {
  tree: string;
  notes?: string;
  hidden?: boolean;
  layout?: 1 | 2;
  rels?: Rel[];
};

export type DeckOptions = {
  slides: DeckSlide[];
  cx?: number;
  cy?: number;
  media?: Record<string, Uint8Array>;
  /** Leave out the layouts and master (Google Slides writes them, but every shape has its own box). */
  noMaster?: boolean;
};

/** A PowerPoint package of slides over a two-layout master (title slide; title and content). */
export async function makePptx(opts: DeckOptions): Promise<Uint8Array> {
  const files: ZipInput = {
    '[Content_Types].xml': contentTypes({ '/ppt/presentation.xml': PPTX_MAIN }),
    '_rels/.rels': relsXml([
      { id: 'rId1', type: 'officeDocument', target: 'ppt/presentation.xml' },
    ]),
  };
  const presRels: Rel[] = [];
  const ids: string[] = [];
  opts.slides.forEach((s, i) => {
    const n = i + 1;
    presRels.push({ id: `rId${n + 10}`, type: 'slide', target: `slides/slide${n}.xml` });
    ids.push(`<p:sldId id="${255 + n}" r:id="rId${n + 10}"/>`);
    files[`ppt/slides/slide${n}.xml`] = slideXml(s.tree, s.hidden ? ' show="0"' : '');
    const rels: Rel[] = [...(s.rels ?? [])];
    if (!opts.noMaster) {
      rels.push({
        id: 'rIdLayout',
        type: 'slideLayout',
        target: `../slideLayouts/slideLayout${s.layout ?? 2}.xml`,
      });
    }
    if (s.notes) {
      rels.push({
        id: 'rIdNotes',
        type: 'notesSlide',
        target: `../notesSlides/notesSlide${n}.xml`,
      });
      files[`ppt/notesSlides/notesSlide${n}.xml`] = notesXml(s.notes);
    }
    files[`ppt/slides/_rels/slide${n}.xml.rels`] = relsXml(rels);
  });
  files['ppt/presentation.xml'] =
    `${XML}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:sldIdLst>${ids.join('')}</p:sldIdLst><p:sldSz cx="${opts.cx ?? 12192000}" cy="${opts.cy ?? 6858000}"/></p:presentation>`;
  files['ppt/_rels/presentation.xml.rels'] = relsXml(presRels);
  if (!opts.noMaster) {
    files['ppt/slideMasters/slideMaster1.xml'] = MASTER;
    files['ppt/slideLayouts/slideLayout1.xml'] = layoutXml(
      `${sp({ id: 2, ph: '<p:ph type="ctrTitle"/>', box: xfrm(1524000, 1122363, 9144000, 2387600), paras: ap('Title'), bodyPr: ' anchor="b"', lstStyle: '<a:lvl1pPr algn="ctr"><a:defRPr sz="6000"/></a:lvl1pPr>' })}${sp({ id: 3, ph: '<p:ph type="subTitle" idx="1"/>', box: xfrm(1524000, 3602038, 9144000, 1655762), paras: ap('Subtitle'), lstStyle: '<a:lvl1pPr><a:buNone/><a:defRPr sz="2400"/></a:lvl1pPr>' })}`,
    );
    files['ppt/slideLayouts/slideLayout2.xml'] = layoutXml(
      `${sp({ id: 2, ph: '<p:ph type="title"/>', paras: ap('Title') })}${sp({ id: 3, ph: '<p:ph idx="1"/>', paras: ap('Text') })}`,
    );
    for (const n of [1, 2]) {
      files[`ppt/slideLayouts/_rels/slideLayout${n}.xml.rels`] = relsXml([
        { id: 'rId1', type: 'slideMaster', target: '../slideMasters/slideMaster1.xml' },
      ]);
    }
  }
  for (const [path, bytes] of Object.entries(opts.media ?? {})) files[path] = bytes;
  return makeZip(files);
}

/** What PowerPoint writes for a short deck: placeholders that inherit, a picture, a group, a table, a hidden slide. */
export function powerPointSampleDeck(): Promise<Uint8Array> {
  return makePptx({
    slides: [
      {
        layout: 1,
        tree: `${sp({ ph: '<p:ph type="ctrTitle"/>', paras: ap('Quarterly Review') })}${sp({ id: 3, ph: '<p:ph type="subTitle" idx="1"/>', paras: ap('Team update') })}`,
        notes: 'Welcome everyone.\nKeep it short.',
      },
      {
        tree: [
          sp({ ph: '<p:ph type="title"/>', paras: ap('Results') }),
          sp({
            id: 3,
            ph: '<p:ph idx="1"/>',
            paras: [
              ap('Revenue up'),
              ap('In every region', ' lvl="1"'),
              '<a:p/>',
              ap('No bullet here', '<a:buNone/>'),
            ].join(''),
          }),
          pic('rIdImg', xfrm(6096000, 1825625, 4000000, 3000000), {
            crop: true,
            alt: 'Sales chart',
          }),
          `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="20" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="1000000" y="5000000"/><a:ext cx="2000000" cy="1000000"/><a:chOff x="0" y="0"/><a:chExt cx="4000000" cy="2000000"/></a:xfrm></p:grpSpPr>${sp({ id: 21, box: xfrm(0, 0, 4000000, 2000000), paras: ap('In a group', '', ' b="1"') })}</p:grpSp>`,
          `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="30" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"/></a:graphic></p:graphicFrame>`,
          `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="40" name="Line"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm(0, 0, 100, 100)}</p:spPr></p:cxnSp>`,
        ].join(''),
        rels: [{ id: 'rIdImg', type: 'image', target: '../media/image1.png' }],
        notes: 'Pause for questions.',
      },
      {
        hidden: true,
        tree: [
          sp({
            id: 2,
            box: xfrm(500000, 500000, 6000000, 2000000),
            paras: [
              ap('First', '<a:buAutoNum type="arabicPeriod"/>', ' sz="2000"'),
              ap('Second', '<a:buAutoNum type="arabicPeriod"/>'),
            ].join(''),
            bodyPr: ' anchor="ctr"',
          }),
          pic('rIdImg', xfrm(0, 0, 100, 100), { video: true }),
        ].join(''),
        rels: [{ id: 'rIdImg', type: 'image', target: '../media/image1.png' }],
      },
    ],
    media: { 'ppt/media/image1.png': TINY_PNG },
  });
}

/** What a Google Slides download writes: a 10 x 5.625 in slide, every shape with its own box, explicit bullets. */
export function googleSlidesSampleDeck(): Promise<Uint8Array> {
  return makePptx({
    cx: 9144000,
    cy: 5143500,
    noMaster: true,
    slides: [
      {
        tree: `${sp({ ph: '<p:ph type="title"/>', box: xfrm(311700, 445025, 8520600, 572700), paras: ap('Roadmap', ' algn="ctr"', ' sz="3600"') })}${sp({ id: 3, ph: '<p:ph type="body" idx="1"/>', box: xfrm(311700, 1152475, 8520600, 3416400), paras: [ap('Discover', '<a:buChar char="●"/>', ' sz="1800"'), ap('Build', '<a:buChar char="●"/>')].join('') })}`,
        notes: 'Talk about timing.',
      },
    ],
  });
}

/** A long deck: `slides` slides, each a title, a body of five bullets of varied text and a 150 KB photo. */
export function longDeck(slides: number): Promise<Uint8Array> {
  const rand = seeded(slides);
  return makePptx({
    slides: Array.from({ length: slides }, (_, i) => ({
      tree: `${sp({ ph: '<p:ph type="title"/>', paras: ap(`Slide ${i + 1}: ${words(rand, 4)}`) })}${sp({ id: 3, ph: '<p:ph idx="1"/>', paras: Array.from({ length: 5 }, () => ap(words(rand, 12), '', ' sz="2400" dirty="0"')).join('') })}${pic('rIdImg', xfrm(6096000, 1825625, 4000000, 3000000))}`,
      rels: [{ id: 'rIdImg', type: 'image', target: `../media/image${i + 1}.jpeg` }],
      notes: words(rand, 40),
    })),
    media: Object.fromEntries(
      Array.from({ length: slides }, (_, i) => [
        `ppt/media/image${i + 1}.jpeg`,
        noiseBytes(rand, 150),
      ]),
    ),
  });
}

/** A File-like Blob of package bytes. */
export const asBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart]);
