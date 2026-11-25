import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuLeastMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { ArticleBlock, ArticleFlow } from './article-flow';
import { applyArticleOps, diffArticleFlow, type ArticleOp } from './article-flow-ops';

// docs/specs/007-editor/article-pages.md "Collaboration": ops applied in place, as the array walk read them.

const para = (id: string, text = id): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: [{ text }],
});

// The placement rules read as one array walk, each op a scan: what the linked list must answer the same as.
function reference(flow: ArticleFlow, ops: readonly ArticleOp[]): string[] {
  const blocks = [...flow.blocks];
  for (const op of ops) {
    if (op.kind === 'remove') {
      const i = blocks.findIndex((b) => b.id === op.id);
      if (i >= 0) blocks.splice(i, 1);
      continue;
    }
    if (op.kind !== 'put') continue;
    const at = blocks.findIndex((b) => b.id === op.block.id);
    if (op.after === undefined && op.before === undefined) {
      if (at >= 0) blocks[at] = op.block;
      else blocks.push(op.block);
      continue;
    }
    if (at >= 0) blocks.splice(at, 1);
    const afterAt =
      op.after === null || op.after === undefined ? -1 : blocks.findIndex((b) => b.id === op.after);
    if (op.after === null || afterAt >= 0) {
      blocks.splice(afterAt + 1, 0, op.block);
      continue;
    }
    const beforeAt =
      op.before === null || op.before === undefined
        ? blocks.length
        : blocks.findIndex((b) => b.id === op.before);
    if (beforeAt >= 0) {
      blocks.splice(beforeAt, 0, op.block);
      continue;
    }
    blocks.splice(at >= 0 ? at : blocks.length, 0, op.block);
  }
  return blocks.map((b) => `${b.id}:${(b as { runs: { text: string }[] }).runs[0]!.text}`);
}

const idsOf = (flow: ArticleFlow) =>
  flow.blocks.map((b) => `${b.id}:${(b as { runs: { text: string }[] }).runs[0]!.text}`);

// A small seeded generator, so a failure always replays.
function random(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
    return s / 2_147_483_648;
  };
}

describe('applyArticleOps', () => {
  it('places every put and remove as the array walk does, missing neighbours included', () => {
    const next = random(7);
    const id = () => `b-${Math.floor(next() * 12)}`;
    const place = () => {
      const r = next();
      return r < 0.2 ? undefined : r < 0.35 ? null : id();
    };
    for (let round = 0; round < 400; round++) {
      const flow = { blocks: Array.from({ length: 6 }, (_, i) => para(`b-${i * 2}`)) };
      const ops: ArticleOp[] = Array.from({ length: 8 }, (_, k): ArticleOp => {
        if (next() < 0.25) return { kind: 'remove', id: id() };
        const after = place();
        const before = place();
        return {
          kind: 'put',
          block: para(id(), `v${round}.${k}`),
          ...(after !== undefined ? { after } : {}),
          ...(before !== undefined ? { before } : {}),
        };
      });
      const got = applyArticleOps(flow, ops);
      const want = reference(flow, ops);
      if (want.length === 0) expect(got.blocks.map((b) => b.id)).toEqual(['b-empty']);
      else expect(idsOf(got), JSON.stringify(ops)).toEqual(want);
    }
  });

  it('takes an article of the most blocks, arriving whole or rewritten in reverse, within a budget', () => {
    const blocks = Array.from({ length: 5_000 }, (_, i) => para(`b-${i}`));
    const whole = diffArticleFlow(undefined, { blocks });
    const reversed = { blocks: [...blocks].reverse() };
    const moves = diffArticleFlow({ blocks }, reversed);
    expect(applyArticleOps(undefined, whole).blocks).toEqual(blocks);
    expect(applyArticleOps({ blocks }, moves).blocks).toEqual(reversed.blocks);
    // An array walk took about 190 ms and 290 ms here, a scan per op; the linked list about 3 ms each.
    const ms = cpuLeastMsOf(() => {
      applyArticleOps(undefined, whole);
      applyArticleOps({ blocks }, moves);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(60));
  });
});
