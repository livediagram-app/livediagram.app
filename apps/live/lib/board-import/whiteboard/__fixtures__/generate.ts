// Writes the SYNTHESISED Microsoft Whiteboard fixtures beside this file:
// `pnpm --filter @livediagram/live exec tsx lib/board-import/whiteboard/__fixtures__/generate.ts`.
// Deterministic: the same code writes the same bytes.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { anchor, boardHtml, inkGroup, inkStroke, type Pt } from './board-markup';
import { writeZip } from './zip-writer';

const here = dirname(fileURLToPath(import.meta.url));

// A handwritten-looking squiggle: deterministic, no randomness.
const squiggle = (x0: number, y0: number, length: number, amp: number): Pt[] =>
  Array.from({ length: Math.round(length / 3) + 1 }, (_, i) => ({
    x: x0 + i * 3,
    y: y0 + Math.sin(i / 2.5) * amp + Math.sin(i / 7) * amp * 0.6,
  }));

const circle = (cx: number, cy: number, radius: number): Pt[] =>
  Array.from({ length: 73 }, (_, i) => ({
    x: cx + Math.cos((i / 72) * 2 * Math.PI) * radius,
    y: cy + Math.sin((i / 72) * 2 * Math.PI) * radius,
  }));

export function busyBoardHtml(): string {
  return boardHtml(
    [
      anchor({
        apikey: 'ink-black',
        left: 120,
        top: 80,
        content: inkGroup([
          inkStroke('pen-1', { points: squiggle(0, 20, 300, 8), width: 2, rgba: [0, 0, 0, 1] }),
          inkStroke('pen-2', { points: squiggle(0, 60, 240, 10), width: 2, rgba: [0, 0, 0, 1] }),
        ]),
      }),
      anchor({
        apikey: 'ink-red-thick',
        left: 120,
        top: 200,
        content: inkGroup([
          inkStroke('pen-3', { points: circle(60, 60, 50), width: 6, rgba: [218, 59, 1, 1] }),
        ]),
      }),
      anchor({
        apikey: 'ink-highlighter',
        left: 110,
        top: 95,
        content: inkGroup([
          inkStroke('hl-1', {
            points: squiggle(0, 0, 280, 1),
            width: 18,
            rgba: [255, 230, 0, 0.5],
            highlighter: true,
          }),
        ]),
      }),
      anchor({
        apikey: 'ink-wide',
        left: 320,
        top: 220,
        transform: 'matrix(1.5, 0, 0, 1.5, 0, 0)',
        content: inkGroup([
          inkStroke('wide-1', {
            points: squiggle(0, 20, 120, 12),
            width: 24,
            rgba: [0, 120, 212, 1],
            noCentreline: true,
          }),
        ]),
      }),
      anchor({
        apikey: 'note-1',
        type: 'Note',
        left: 600,
        top: 80,
        content:
          '<div class="note" style="width: 200px; height: 200px; background: rgb(255, 242, 157);"><p>Synthesised note</p></div>',
      }),
    ],
    { background: '#ffffff' },
  );
}

const html = busyBoardHtml();
writeFileSync(join(here, 'synth-busy-board.html'), html);
writeFileSync(
  join(here, 'synth-busy-board.zip'),
  writeZip([
    { name: 'synth-busy-board.html', data: html },
    {
      name: 'synth-busy-board-comments.json',
      data: JSON.stringify({ commentThreads: [] }, null, 2),
    },
  ]),
);
console.info('wrote synth-busy-board.html and .zip');
