// Rebuilds the derived draw.io fixtures from the hand-written sources beside
// this file (docs/specs/020-import-export/blueprints/drawio-import.md "Assets").
// Deterministic: the same sources always produce byte-identical outputs.
//
//   node apps/live/lib/drawio/__fixtures__/generate.ts
//
// The forms mirror what draw.io itself writes: a compressed page is
// base64(deflateRaw(encodeURIComponent(xml))) (draw.io's Graph.compress), a
// .drawio.svg carries the mxfile in its `content` attribute, and a
// .drawio.png carries it in a tEXt (URI-encoded) or zTXt (zlib) chunk keyed
// `mxfile`.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync, deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), 'utf8');
const write = (name: string, data: string | Uint8Array) => writeFileSync(join(here, name), data);

const compressXml = (xml: string) =>
  deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');

// Every <diagram> body in the file, compressed in place.
function compressMxfile(mxfile: string): string {
  return mxfile.replace(
    /(<diagram\b[^>]*>)\s*(<mxGraphModel[\s\S]*?<\/mxGraphModel>)\s*(<\/diagram>)/g,
    (_all, open: string, model: string, close: string) => `${open}${compressXml(model)}${close}`,
  );
}

const escapeAttr = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '&#10;');

function svgWith(content: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
    'version="1.1" width="200px" height="100px" viewBox="-0.5 -0.5 200 100" ' +
    `content="${escapeAttr(content)}"><defs/><g><rect x="0" y="0" width="200" height="100" ` +
    'fill="#ffffff" stroke="#000000"/></g></svg>\n'
  );
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData) >>> 0);
  return Buffer.concat([length, typeAndData, crc]);
}

// A 1x1 PNG with one text chunk before the image data, where draw.io puts it.
function pngWith(textChunk: Buffer | null): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const idat = deflateSync(Buffer.from([0, 255, 255, 255, 255]));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...(textChunk ? [textChunk] : []),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const tEXt = (keyword: string, text: string) =>
  chunk(
    'tEXt',
    Buffer.concat([Buffer.from(`${keyword}\0`, 'latin1'), Buffer.from(text, 'latin1')]),
  );

const zTXt = (keyword: string, text: string) =>
  chunk(
    'zTXt',
    Buffer.concat([
      Buffer.from(`${keyword}\0\0`, 'latin1'),
      deflateSync(Buffer.from(text, 'utf8')),
    ]),
  );

const flowchart = read('flowchart.drawio');
const multiPage = read('multi-page.drawio');
const swimlanes = read('swimlanes.drawio');
const cloud = read('cloud-architecture.drawio');

write('flowchart.compressed.drawio', compressMxfile(flowchart));
write('multi-page.compressed.drawio', compressMxfile(multiPage));

const bareModel = /<mxGraphModel[\s\S]*?<\/mxGraphModel>/.exec(flowchart)?.[0];
if (!bareModel) throw new Error('flowchart.drawio has no mxGraphModel');
write('flowchart.mxgraphmodel.xml', `${bareModel}\n`);

write('cloud-architecture.drawio.svg', svgWith(compressMxfile(cloud)));
write('flowchart.drawio.png', pngWith(tEXt('mxfile', encodeURIComponent(flowchart))));
write('swimlanes.drawio.png', pngWith(zTXt('mxfile', encodeURIComponent(swimlanes))));
write('no-diagram.png', pngWith(null));

console.info('[drawio-fixtures] generated');
