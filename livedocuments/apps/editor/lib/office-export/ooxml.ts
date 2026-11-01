// The Office Open XML package both writers share (docs/specs/020-import-export/blueprints/office-export.md "The
// package"): text made safe for XML, relationship parts, the document properties, and the parts zipped with their
// content types onto the shared zip writer. Pure and browser-safe.

import { writeZip } from '@liveworkspace/workbench/lib/zip-writer';

/** One part of a package: its path and its XML text or bytes, with the content type an override names. */
export type OoxmlPart = { path: string; type?: string } & (
  { xml: string; bytes?: undefined } | { bytes: Uint8Array; xml?: undefined }
);

export type OoxmlRel = { id: string; type: string; target: string; external?: true };

export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// The relationship type namespace (transitional OOXML), and the package's own.
const RT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const REL = {
  officeDocument: `${RT}/officeDocument`,
  coreProps:
    'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  extendedProps: `${RT}/extended-properties`,
  image: `${RT}/image`,
  hyperlink: `${RT}/hyperlink`,
  theme: `${RT}/theme`,
  styles: `${RT}/styles`,
  numbering: `${RT}/numbering`,
  settings: `${RT}/settings`,
  footer: `${RT}/footer`,
  header: `${RT}/header`,
  slide: `${RT}/slide`,
  slideLayout: `${RT}/slideLayout`,
  slideMaster: `${RT}/slideMaster`,
  notesSlide: `${RT}/notesSlide`,
  notesMaster: `${RT}/notesMaster`,
  presProps: `${RT}/presProps`,
  viewProps: `${RT}/viewProps`,
  tableStyles: `${RT}/tableStyles`,
} as const;

// Characters XML 1.0 cannot hold at all (C0 controls other than tab, line feed and carriage return, lone
// surrogates, U+FFFE and U+FFFF): dropped, so a stray control character pasted into a label never makes a file an app
// refuses to open.
const INVALID_XML =
  // oxlint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Text or an attribute value made safe for XML: invalid characters dropped, the five specials escaped. */
export function xmlText(value: string): string {
  return value
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** A `.rels` part's XML. */
export function relsXml(rels: readonly OoxmlRel[]): string {
  const rows = rels.map(
    (r) =>
      `<Relationship Id="${r.id}" Type="${r.type}" Target="${xmlText(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`,
  );
  return `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rows.join('')}</Relationships>`;
}

/** Where a part's relationships live: `ppt/slides/_rels/slide1.xml.rels`. */
export function relsPathFor(partPath: string): string {
  const at = partPath.lastIndexOf('/');
  return `${partPath.slice(0, at + 1)}_rels/${partPath.slice(at + 1)}.rels`;
}

/** The document's core properties: its title and when it was made. */
export function corePropsXml(title: string, when: Date): string {
  const stamp = when.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return (
    `${XML_DECL}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"` +
    ` xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"` +
    ` xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${xmlText(title)}</dc:title><dc:creator>livedocuments</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified></cp:coreProperties>`
  );
}

/** The extended properties: the application that wrote the file. */
export function appPropsXml(): string {
  return (
    `${XML_DECL}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"` +
    ` xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>livedocuments</Application></Properties>`
  );
}

export const CORE_PROPS_TYPE = 'application/vnd.openxmlformats-package.core-properties+xml';
export const APP_PROPS_TYPE =
  'application/vnd.openxmlformats-officedocument.extended-properties+xml';

// The extensions a Default entry types, so a picture or a .rels part needs no override of its own.
const DEFAULT_TYPES: Readonly<Record<string, string>> = {
  rels: 'application/vnd.openxmlformats-package.relationships+xml',
  xml: 'application/xml',
  png: 'image/png',
  jpeg: 'image/jpeg',
};

/** A picture's file extension, from its first bytes: JPEG's marker, else PNG. */
export function imageExt(bytes: Uint8Array): 'jpeg' | 'png' {
  return bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpeg' : 'png';
}

function contentTypesXml(parts: readonly OoxmlPart[]): string {
  const defaults = Object.entries(DEFAULT_TYPES).map(
    ([ext, type]) => `<Default Extension="${ext}" ContentType="${type}"/>`,
  );
  const overrides = parts
    .filter((p) => p.type)
    .map((p) => `<Override PartName="/${xmlText(p.path)}" ContentType="${p.type}"/>`);
  return `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults.join('')}${overrides.join('')}</Types>`;
}

/** The package as one .zip: `[Content_Types].xml` first, then every part in order. */
export function writeOoxmlPackage(
  parts: readonly OoxmlPart[],
  when: Date,
): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  return writeZip(
    [
      { name: '[Content_Types].xml', data: enc.encode(contentTypesXml(parts)) },
      ...parts.map((p) => ({ name: p.path, data: p.bytes ?? enc.encode(p.xml) })),
    ],
    when,
  );
}
