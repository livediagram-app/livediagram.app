// An opened Office package (docs/specs/020-import-export/blueprints/office-import.md "openOfficePackage"): the zip, its
// content types and relationships, and which format it really is. Relationship types are matched by their last
// segment, so transitional and strict files read the same; an external relationship is never followed.

import { OfficeImportError, type FileImportFormat } from './errors';
import { OFFICE_MAX_PART_BYTES } from './limits';
import { openZip, zipKey, type ZipArchive } from './zip';
import { kids, parseXml, type XmlElement } from './xml';

export type OfficeRel = {
  id: string;
  /** The type's last segment: `image`, `hyperlink`, `slide`, `officeDocument`, ... */
  type: string;
  /** Resolved against the part's folder for an internal target; the address as written for an external one. */
  target: string;
  external: boolean;
};

export type OfficePackage = {
  format: FileImportFormat;
  /** The main part: `word/document.xml`, `ppt/presentation.xml`. */
  mainPath: string;
  entryCount: number;
  has(path: string): boolean;
  /** A part's XML, or undefined when the package has no such part. */
  readXml(path: string): Promise<XmlElement | undefined>;
  readBytes(path: string, max: number): Promise<Uint8Array | null>;
  /** A part's relationships by id (empty when it has none). */
  rels(partPath: string): Promise<Map<string, OfficeRel>>;
};

// A compound file's signature: .doc, .ppt, and every password-protected Office file.
const CFB = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const utf8 = new TextDecoder('utf-8');

/** `target` resolved against the folder of `partPath`; an absolute target from the package root. */
export function resolvePartPath(partPath: string, target: string): string {
  const base = target.startsWith('/') ? [] : partPath.split('/').slice(0, -1);
  for (const seg of target.replace(/^\/+/, '').split('/')) {
    if (seg === '..') base.pop();
    else if (seg !== '.' && seg !== '') base.push(seg);
  }
  return base.join('/');
}

/** A target's %-escapes decoded; a malformed one kept as written. */
function safeDecode(target: string): string {
  try {
    return decodeURI(target);
  } catch {
    return target;
  }
}

/** Where a part's relationships live: `word/_rels/document.xml.rels`. */
function relsPathOf(partPath: string): string {
  const parts = partPath.split('/');
  const file = parts.pop() ?? '';
  return [...parts, '_rels', `${file}.rels`].filter(Boolean).join('/');
}

function formatOfContentType(type: string): FileImportFormat | null {
  const t = type.toLowerCase();
  if (t.includes('wordprocessingml') || t.includes('ms-word')) return 'word';
  if (t.includes('presentationml') || t.includes('ms-powerpoint')) return 'powerpoint';
  return null;
}

export async function openOfficePackage(
  bytes: Uint8Array,
  format: FileImportFormat,
): Promise<OfficePackage> {
  if (CFB.every((b, i) => bytes[i] === b)) throw new OfficeImportError('legacy');
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new OfficeImportError('not-a-package');
  const zip: ZipArchive = openZip(bytes);

  const xmlCache = new Map<string, Promise<XmlElement | undefined>>();
  const readXml = (path: string): Promise<XmlElement | undefined> => {
    const key = zipKey(path);
    let hit = xmlCache.get(key);
    if (!hit) {
      hit = zip
        .read(key, OFFICE_MAX_PART_BYTES)
        .then((b) => (b ? parseXml(utf8.decode(b)) : undefined));
      xmlCache.set(key, hit);
    }
    return hit;
  };

  const relsCache = new Map<string, Promise<Map<string, OfficeRel>>>();
  const rels = (partPath: string): Promise<Map<string, OfficeRel>> => {
    const key = zipKey(partPath);
    let hit = relsCache.get(key);
    if (!hit) {
      hit = readXml(relsPathOf(partPath)).then((root) => {
        const out = new Map<string, OfficeRel>();
        for (const r of kids(root)) {
          if (r.name !== 'pr:Relationship') continue;
          const id = r.attrs.Id;
          const target = r.attrs.Target;
          if (!id || target === undefined) continue;
          const external = r.attrs.TargetMode?.toLowerCase() === 'external';
          const type = (r.attrs.Type ?? '').split('/').pop() ?? '';
          out.set(id, {
            id,
            type,
            external,
            target: external ? target : resolvePartPath(partPath, safeDecode(target)),
          });
        }
        return out;
      });
      relsCache.set(key, hit);
    }
    return hit;
  };

  const top = await rels('');
  const main = [...top.values()].find((r) => r.type === 'officeDocument' && !r.external);
  if (!main || !zip.has(main.target)) throw new OfficeImportError('not-a-package');

  const types = await readXml('[Content_Types].xml');
  const override = kids(types).find(
    (o) => o.name === 'ct:Override' && zipKey(o.attrs.PartName ?? '') === zipKey(main.target),
  );
  const own =
    formatOfContentType(override?.attrs.ContentType ?? '') ??
    (zipKey(main.target).startsWith('word/')
      ? 'word'
      : zipKey(main.target).startsWith('ppt/')
        ? 'powerpoint'
        : null);
  if (!own) throw new OfficeImportError('not-a-package');
  if (own !== format) throw new OfficeImportError('wrong-format');

  return {
    format: own,
    mainPath: main.target,
    entryCount: zip.names().length,
    has: (p) => zip.has(p),
    readXml,
    readBytes: (p, max) => zip.read(p, max),
    rels,
  };
}
