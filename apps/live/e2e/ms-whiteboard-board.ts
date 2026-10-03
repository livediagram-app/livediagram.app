// A synthesised Microsoft Whiteboard board export for the end-to-end import
// (docs/specs/020-import-export/whiteboard-import.md): every kind the import maps, drawn by code.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MSWB_TYPE } from '../lib/ms-whiteboard/format';
import {
  CURRENT_UNIT_SCALE,
  boardFiles,
  imageNode,
  inkGroup,
  lineNode,
  polygonNode,
  shapeNode,
  stickyNode,
  textBoxNode,
} from '../lib/ms-whiteboard/ms-whiteboard-fixtures';
import { writeZip } from '../lib/zip-writer-fixture';

const u = (px: number) => Math.round(px / CURRENT_UNIT_SCALE);

/** A pressure stroke through `pts` (canvas px), pressure swelling in the middle. */
function stroke(pts: [number, number][]) {
  return pts.map(([x, y], i) => ({
    x: u(x),
    y: u(y),
    p: 0.35 + 0.6 * Math.sin((Math.PI * i) / (pts.length - 1)),
  }));
}

const wave = (w: number, h: number, n = 40): [number, number][] =>
  Array.from({ length: n }, (_, i) => [
    (w * i) / (n - 1),
    h / 2 + (h / 2) * Math.sin((i / (n - 1)) * Math.PI * 3),
  ]);

const loop = (r: number, n = 48): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [r + r * Math.cos(a), r + r * 0.8 * Math.sin(a)];
  });

const PNG = readFileSync(
  fileURLToPath(new URL('../lib/__fixtures__/excalidraw-export.excalidraw.png', import.meta.url)),
);

/** One board's export files. */
export function syntheticBoard(dir: string, title: string | null, dark: boolean) {
  const name = dir.split('/').pop()!;
  const image = {
    objectId: `${name}-picture`,
    dataId: `${name}-picture-data`,
    file: `${name}-picture.png`,
    bytes: new Uint8Array(PNG),
    image: imageNode({ x: 760, y: 40, w: 400, h: 300, scale: 0.6, dataId: `${name}-picture-data` }),
  };
  return boardFiles(
    {
      id: `${dir}-id`,
      title,
      modified: dark ? '2026-03-02T09:00:00Z' : '2026-02-01T09:00:00Z',
      ...(dark
        ? { background: '#1f1f1f', pattern: MSWB_TYPE.patternGrid }
        : { pattern: MSWB_TYPE.patternDots }),
      elements: [
        inkGroup({
          x: 40,
          y: 40,
          strokes: [
            {
              colour: dark ? '#ebebeb' : '#000000',
              stroke: { width: 512, points: stroke(loop(90)) },
            },
            {
              colour: '#e71224',
              stroke: {
                width: 512,
                points: stroke(wave(220, 40)).map((p) => ({ ...p, y: p.y + u(220) })),
              },
            },
            {
              preset: 'highlighter',
              colour: '#fcfc00',
              alpha: 0.4,
              stroke: {
                width: 2048,
                points: stroke(wave(200, 10, 12)).map((p) => ({ ...p, y: p.y + u(290) })),
              },
            },
            {
              preset: 'rainbow',
              stroke: {
                width: 768,
                points: stroke(wave(240, 60)).map((p) => ({ ...p, y: p.y + u(330) })),
              },
            },
            {
              colour: '#02a556',
              stroke: {
                width: 512,
                points: stroke([
                  [260, 120],
                  [340, 110],
                  [420, 100],
                ]),
              },
              arrowhead: {
                layout: 'arrowhead',
                unitScale: CURRENT_UNIT_SCALE,
                origin: [420, 100],
                width: 512,
                points: [
                  { x: u(-14), y: u(-10) },
                  { x: 0, y: 0 },
                  { x: u(-12), y: u(12) },
                ],
              },
            },
          ],
        }),
        shapeNode({
          x: 470,
          y: 60,
          w: 200,
          h: 120,
          border: '#1f1f1f',
          fill: '#99c9ef',
          text: ['Plan the sprint'],
          fontSize: 20,
          bold: true,
        }),
        stickyNode({ x: 470, y: 220, w: 304, h: 304, scale: 0.5, text: ['Ship it'] }),
        textBoxNode({
          x: 40,
          y: 450,
          text: ['Hand-drawn notes', 'come across'],
          fontSize: 28,
          colour: dark ? 'e080b312-5dd0-5e57-9724-cab19de4cad2' : undefined,
        }),
        lineNode({
          x: 470,
          y: 420,
          from: [0, 0],
          to: [220, 0],
          width: 3,
          colour: '#0069bf',
          endHead: 1,
        }),
        polygonNode({
          cx: 820,
          cy: 420,
          corners: [
            [-60, -40],
            [70, -40],
            [60, 40],
            [-70, 40],
          ],
          colour: '#0069bf',
        }),
      ],
      images: [image],
    },
    dir,
  );
}

/** A .zip holding two boards: a dark one and an untitled light one. */
export function syntheticExportZip(): Buffer {
  const files = [
    ...syntheticBoard('export/board-dark', 'Sprint board', true),
    ...syntheticBoard('export/board-light', null, false),
  ];
  return Buffer.from(writeZip(files.map(([name, data]) => ({ name, data }))));
}
