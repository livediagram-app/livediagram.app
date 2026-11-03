import { describe, expect, it } from 'vitest';
import { concat, PartWriter, type UploadedPart } from './upload';

function sink() {
  const parts: { n: number; bytes: Uint8Array }[] = [];
  return {
    parts,
    async uploadPart(n: number, bytes: Uint8Array): Promise<UploadedPart> {
      parts.push({ n, bytes: bytes.slice() });
      return { partNumber: n, etag: `e${n}` };
    },
  };
}

const bytes = (n: number, fill = 1) => new Uint8Array(n).fill(fill);

describe('PartWriter', () => {
  it('uploads whole parts as they fill and keeps the rest', async () => {
    const s = sink();
    const w = new PartWriter(s, { offset: 0, nextPart: 1, tail: new Uint8Array() }, 4);
    await w.append([bytes(3), bytes(3, 2)]);
    expect(s.parts.map((p) => [...p.bytes])).toEqual([[1, 1, 1, 2]]);
    expect([...w.tail()]).toEqual([2, 2]);
    await w.append([bytes(9, 3)]);
    expect(s.parts.map((p) => p.bytes.length)).toEqual([4, 4, 4]);
    expect(w.offset).toBe(15);
    expect(w.nextPart).toBe(4);
    expect([...w.tail()]).toEqual([3, 3, 3]);
    expect(w.uploaded).toEqual([
      { partNumber: 1, etag: 'e1' },
      { partNumber: 2, etag: 'e2' },
      { partNumber: 3, etag: 'e3' },
    ]);
    await w.finish();
    expect(s.parts.at(-1)).toEqual({ n: 4, bytes: new Uint8Array([3, 3, 3]) });
    expect(w.tail().length).toBe(0);
  });

  it('carries on from a chunk before: its offset, part number and tail', async () => {
    const s = sink();
    const w = new PartWriter(s, { offset: 10, nextPart: 3, tail: bytes(2, 7) }, 4);
    await w.append([bytes(2, 8)]);
    expect(s.parts).toEqual([{ n: 3, bytes: new Uint8Array([7, 7, 8, 8]) }]);
    expect(w.offset).toBe(12);
    // Nothing left: no empty last part.
    await w.finish();
    expect(s.parts).toHaveLength(1);
  });

  it('uploads an empty part when nothing was ever uploaded', async () => {
    const s = sink();
    const w = new PartWriter(s, { offset: 0, nextPart: 1, tail: new Uint8Array() }, 4);
    await w.finish();
    expect(s.parts).toEqual([{ n: 1, bytes: new Uint8Array() }]);
  });
});

it('concat joins chunks, with or without their length', () => {
  expect([...concat([bytes(1, 1), bytes(2, 2)])]).toEqual([1, 2, 2]);
  expect([...concat([bytes(1, 5)], 1)]).toEqual([5]);
});
