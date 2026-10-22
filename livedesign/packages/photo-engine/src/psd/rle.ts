// PackBits, the run-length coding PSD channel data uses (Apple Technical Note TN1023): a header byte
// n, then n + 1 literal bytes (0..127) or one byte repeated 1 - n times (-127..-1); -128 is skipped.

/** One row packed. */
export function packBits(row: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  const n = row.length;
  while (i < n) {
    // A run of at least three repeats is worth packing.
    let run = 1;
    while (i + run < n && run < 128 && row[i + run] === row[i]) run++;
    if (run >= 3 || (run === 2 && i + run === n)) {
      out.push(257 - run, row[i]!);
      i += run;
      continue;
    }
    const start = i;
    let lit = 0;
    while (i < n && lit < 128) {
      if (i + 2 < n && row[i] === row[i + 1] && row[i] === row[i + 2]) break;
      i++;
      lit++;
    }
    out.push(lit - 1);
    for (let k = start; k < start + lit; k++) out.push(row[k]!);
  }
  return Uint8Array.from(out, (v) => v & 255);
}

/** `count` bytes unpacked from `src` at `at`; answers the bytes and where reading stopped. */
export function unpackBits(
  src: Uint8Array,
  at: number,
  count: number,
  length: number,
): { bytes: Uint8Array; end: number } {
  const out = new Uint8Array(count);
  let o = 0;
  let i = at;
  const end = at + length;
  while (o < count && i < end) {
    const h = src[i++]!;
    const n = h > 127 ? h - 256 : h;
    if (n >= 0) {
      const len = Math.min(n + 1, count - o, end - i);
      out.set(src.subarray(i, i + len), o);
      o += len;
      i += n + 1;
    } else if (n !== -128) {
      const len = Math.min(1 - n, count - o);
      out.fill(src[i++]!, o, o + len);
      o += len;
    }
  }
  return { bytes: out, end: i };
}
