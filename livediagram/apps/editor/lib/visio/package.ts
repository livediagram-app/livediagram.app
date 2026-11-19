// A .vsdx as a package of parts (docs/specs/020-import-export/blueprints/visio-import.md steps 1 and 2): sniffed
// by content, its zip listed by the shared bounded reader, each XML part inflated under one budget and parsed
// inert (trusted types), never rendered. Relationship targets resolve inside the package only.

import { parseInert } from '@livediagram/ui/trusted-types';
import { ByteBudget } from '@/lib/inflate';
import { listZip, readZipEntry } from '@/lib/zip-reader';
import {
  VISIO_MAX_INFLATED_BYTES,
  VISIO_MAX_PART_BYTES,
  VISIO_MAX_XML_ELEMENTS,
  VISIO_MAX_ZIP_ENTRIES,
} from './limits';
import { VisioRefused } from './refusals';

export type VisioKind = 'vsdx' | 'vsd' | 'vdx';

const SNIFF_TEXT_BYTES = 4096;
export const PAGES_PART = 'visio/pages/pages.xml';

/** What the bytes are, by content: a zip, an OLE file (the binary .vsd), Visio 2010 XML, or none of them. */
export function sniffVisio(bytes: Uint8Array): VisioKind | null {
  const [a, b, c, d] = bytes;
  if (a === 0x50 && b === 0x4b && c === 0x03 && d === 0x04) return 'vsdx';
  if (a === 0xd0 && b === 0xcf && c === 0x11 && d === 0xe0) return 'vsd';
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, SNIFF_TEXT_BYTES));
  const text = head.replace(/^\uFEFF/, '').trimStart();
  return text.startsWith('<') && text.includes('VisioDocument') ? 'vdx' : null;
}

type Entry = Parameters<typeof readZipEntry>[1];

export type VisioPackage = {
  has(path: string): boolean;
  /** The part's root element, parsed inert; null when the package has no such part. */
  part(path: string): Promise<Element | null>;
  /** The part's relationships: `Id` to the target's path inside the package. */
  rels(path: string): Promise<Map<string, string>>;
  /** A media entry's bytes, or null when absent or larger than `maxBytes`. */
  bytes(path: string, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null>;
};

function normalise(name: string): string {
  let path = name.split('\\').join('/');
  while (path.startsWith('/')) path = path.slice(1);
  return path;
}

/** `target` resolved against the folder of `base`; null when it climbs out of the package. */
export function resolveTarget(base: string, target: string): string | null {
  const parts = target.startsWith('/') ? [] : base.split('/').slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.join('/');
}

const relsPathOf = (path: string) => {
  const slash = path.lastIndexOf('/');
  return `${path.slice(0, slash + 1)}_rels/${path.slice(slash + 1)}.rels`;
};

/** Opens a .vsdx's package; refuses anything that is not one. */
export function openVisioPackage(bytes: Uint8Array<ArrayBuffer>): VisioPackage {
  const listed = listZip(bytes);
  if (!listed.ok) throw new VisioRefused('damaged');
  if (listed.entries.length > VISIO_MAX_ZIP_ENTRIES) throw new VisioRefused('damaged');
  const entries = new Map<string, Entry>();
  for (const entry of listed.entries) entries.set(normalise(entry.name), entry);
  if (!entries.has(PAGES_PART)) throw new VisioRefused('not-visio');
  const budget = new ByteBudget(VISIO_MAX_INFLATED_BYTES);
  const parsed = new Map<string, Promise<Element | null>>();

  const read = async (entry: Entry): Promise<Uint8Array<ArrayBuffer>> => {
    const out = await readZipEntry(bytes, entry, budget);
    if (out.ok) return out.bytes;
    throw new VisioRefused(out.refusal === 'too-large' ? 'too-large-unpacked' : 'damaged');
  };

  const parsePart = async (path: string): Promise<Element | null> => {
    const entry = entries.get(path);
    if (!entry) return null;
    if (entry.size > VISIO_MAX_PART_BYTES) throw new VisioRefused('too-large-unpacked');
    const text = new TextDecoder('utf-8').decode(await read(entry)).replace(/^\uFEFF/, '');
    const doc = parseInert(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) throw new VisioRefused('damaged');
    if (doc.getElementsByTagName('*').length > VISIO_MAX_XML_ELEMENTS) {
      throw new VisioRefused('too-large-unpacked');
    }
    return doc.documentElement;
  };

  const part = (path: string) => {
    let pending = parsed.get(path);
    if (!pending) {
      pending = parsePart(path);
      parsed.set(path, pending);
    }
    return pending;
  };

  return {
    has: (path) => entries.has(path),
    part,
    async rels(path) {
      const out = new Map<string, string>();
      const root = await part(relsPathOf(path));
      for (const rel of Array.from(root?.children ?? [])) {
        if (rel.localName !== 'Relationship' || rel.getAttribute('TargetMode') === 'External')
          continue;
        const id = rel.getAttribute('Id');
        const target = resolveTarget(path, rel.getAttribute('Target') ?? '');
        if (id && target) out.set(id, target);
      }
      return out;
    },
    async bytes(path, maxBytes) {
      const entry = entries.get(path);
      if (!entry || entry.size > maxBytes) return null;
      return read(entry);
    },
  };
}
