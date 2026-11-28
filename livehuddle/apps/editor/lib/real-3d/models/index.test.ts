// docs/specs/008-canvas/3d-engine.md "Block models": a kind is looked up among the table's own kinds only, so a kind
// named after an Object.prototype method builds the plain block rather than calling that method.
import { describe, expect, it } from 'vitest';
import { createShape } from '@livehuddle/document';
import { buildModel, MODELS } from '.';
import { pieceFrame } from '../piece-frame';
import { pieceTones } from '../piece-tones';

const context = () => {
  const el = { ...createShape('desk', 0, 0), id: 'piece' };
  return { f: pieceFrame(el), t: pieceTones(null, '#e6e9ee', '#334155'), seats: [] };
};

describe('buildModel', () => {
  it('builds a kind with a model of its own from the table', () => {
    expect(MODELS['desk']).toBeTypeOf('function');
    expect(buildModel('desk', context()).positions.length).toBeGreaterThan(0);
  });

  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'builds the plain block for %s, never a prototype method',
    (kind) => {
      const m = buildModel(kind, context());
      // One block: six faces of two triangles, three corners of three numbers each.
      expect(m.positions.length).toBe(6 * 2 * 3 * 3);
    },
  );
});
