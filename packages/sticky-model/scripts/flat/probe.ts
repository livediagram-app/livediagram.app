import { detectStickies } from '../../../sticky-vision/src/detect';
import { HYBRID_RULES } from '../../../sticky-vision/src/hybrid';
import { CUE_OPTIONS, cuesOf } from '../../src/cues';
import { isFlatImage } from '../../src/flatness';
import { predictProbs } from '../model/infer';
import { tf } from '../model/tf';
import { WEIGHTS_DIR } from '../hybrid/weights';
import { drawnBoards, type Board, type DrawnNote } from './boards';

// The boundary model on drawn, flat boards (group O): does the hybrid keep
// every note the classical detector finds?
//
//   npx tsx scripts/flat/probe.ts [--verbose]
//
// Per board: notes drawn, found by the classical detector, found by the hybrid
// (a box matching a note at IoU 0.5 or more), and the notes the hybrid LOST
// that the classical detector had, and whether the editor would ask the
// model at all (`isFlatImage`: a flat drawing goes to the classical detector
// alone, so what it ships loses nothing there). `--verbose` adds, per note, the model's
// mean background over its middle half and its best core probability.

type Rect = { x: number; y: number; w: number; h: number };

const iou = (a: Rect, b: Rect) => {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const i = ix * iy;
  return i / (a.w * a.h + b.w * b.h - i);
};

const found = (notes: DrawnNote[], boxes: Rect[]) =>
  notes.map((n) => boxes.some((b) => iou(n, b) >= 0.5));

function modelOn(probs: Float32Array, width: number, n: DrawnNote) {
  let bg = 0;
  let count = 0;
  let core = 0;
  for (let y = n.y; y < n.y + n.h; y += 1) {
    for (let x = n.x; x < n.x + n.w; x += 1) {
      const p = (y * width + x) * 3;
      core = Math.max(core, probs[p + 1]!);
      const inner =
        x >= n.x + n.w / 4 &&
        x < n.x + (3 * n.w) / 4 &&
        y >= n.y + n.h / 4 &&
        y < n.y + (3 * n.h) / 4;
      if (inner) {
        bg += probs[p]!;
        count += 1;
      }
    }
  }
  return { bg: bg / count, core };
}

export type BoardResult = {
  board: Board;
  classical: boolean[];
  hybrid: boolean[];
  extra: number;
  flat: boolean;
};

export async function probeBoards(weights = WEIGHTS_DIR): Promise<BoardResult[]> {
  const model = await tf.loadLayersModel(`file://${weights}/model.json`);
  return drawnBoards().map((board) => {
    const { image } = board;
    const probs = predictProbs(model, image.data, image.width, image.height);
    const cues = cuesOf(probs, image.width, image.height, CUE_OPTIONS);
    const classical = detectStickies(image);
    const hybrid = detectStickies(image, { model: { cues, rules: HYBRID_RULES } });
    const hit = found(board.notes, hybrid);
    if (process.argv.includes('--verbose')) {
      for (const n of board.notes) {
        const m = modelOn(probs, image.width, n);
        console.log(
          `  ${board.name} ${n.fill} ${n.x},${n.y} ${n.w}px bg ${m.bg.toFixed(2)} core ${m.core.toFixed(2)}`,
        );
      }
    }
    return {
      board,
      classical: found(board.notes, classical),
      hybrid: hit,
      extra: hybrid.length - hit.filter(Boolean).length,
      flat: isFlatImage(image),
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = await probeBoards();
  let drawn = 0;
  let classical = 0;
  let hybrid = 0;
  let lost = 0;
  let shippedLost = 0;
  for (const r of results) {
    const c = r.classical.filter(Boolean).length;
    const h = r.hybrid.filter(Boolean).length;
    const l = r.classical.filter((v, i) => v && !r.hybrid[i]).length;
    drawn += r.board.notes.length;
    classical += c;
    hybrid += h;
    lost += l;
    if (!r.flat) shippedLost += l;
    console.log(
      `${r.board.name.padEnd(22)} notes ${String(r.board.notes.length).padStart(3)}  classical ${String(c).padStart(3)}  hybrid ${String(h).padStart(3)}  lost ${l}  extra ${r.extra}  ${r.flat ? 'flat' : 'photo'}`,
    );
  }
  console.log(
    `TOTAL notes ${drawn}  classical ${classical}  hybrid ${hybrid}  lost to the model ${lost}  as shipped (flat images classical) ${shippedLost}  (${WEIGHTS_DIR})`,
  );
}
