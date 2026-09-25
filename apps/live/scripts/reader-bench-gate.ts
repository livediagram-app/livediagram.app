// The PP-OCRv6 detector gate, measured (docs/vision/handwriting-readers.md):
// SmolVLM's answer is kept only where PP-OCRv6-tiny's text detector found at
// least one line of text in the same crop, and blanked where it found none.
//
// Takes a SmolVLM run and a detector run (`--reader ppocr-v6-tiny-det`, whose
// "read" is the number of text lines found) over the same crops, and writes the
// gated run, which reader-bench-score.mts scores like any other:
//
//   npx tsx scripts/reader-bench-gate.ts <smolvlm.json> <det.json> <gated.json>
import { readFileSync, writeFileSync } from 'node:fs';

export type BenchResult = {
  wall: string;
  index: number;
  truth: string | null;
  width: number;
  height: number;
  read: string;
  ms: number;
};

const key = (r: { wall: string; index: number }) => `${r.wall}-${r.index}`;

export function gateRun(vlm: BenchResult[], det: BenchResult[]): BenchResult[] {
  const lines = new Map(det.map((r) => [key(r), Number(r.read)]));
  return vlm.map((r) => {
    const found = lines.get(key(r));
    if (found === undefined) throw new Error(`the detector run has no note ${key(r)}`);
    return found > 0 ? r : { ...r, read: '' };
  });
}

if (process.argv[1]?.endsWith('reader-bench-gate.ts')) {
  const [vlmFile, detFile, out] = process.argv.slice(2);
  if (!vlmFile || !detFile || !out) throw new Error('usage: <smolvlm.json> <det.json> <out.json>');
  const vlm = JSON.parse(readFileSync(vlmFile, 'utf8'));
  const det = JSON.parse(readFileSync(detFile, 'utf8'));
  writeFileSync(
    out,
    JSON.stringify(
      {
        ...vlm,
        reader: `${vlm.reader} + ${det.reader} gate`,
        results: gateRun(vlm.results, det.results),
      },
      null,
      1,
    ),
  );
  console.log(`gated ${vlm.results.length} notes → ${out}`);
}
