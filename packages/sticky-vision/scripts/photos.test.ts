import { describe, expect, it } from 'vitest';
import { resizeGeometry, WORKING_EDGE_PX, workingEdgeFrom } from './photos';

describe('workingEdgeFrom', () => {
  it('defaults to the editor working size', () => {
    expect(workingEdgeFrom(['node', 'calibrate.ts'])).toBe(WORKING_EDGE_PX);
  });

  it('reads --edge', () => {
    expect(workingEdgeFrom(['node', 'calibrate.ts', '--edge', '2000'])).toBe(2000);
  });

  it('rejects an edge that is not a positive whole number', () => {
    expect(() => workingEdgeFrom(['--edge', 'big'])).toThrow(/--edge/);
    expect(() => workingEdgeFrom(['--edge', '0'])).toThrow(/--edge/);
    expect(() => workingEdgeFrom(['--edge'])).toThrow(/--edge/);
  });
});

describe('resizeGeometry', () => {
  it('only ever shrinks, as the editor never upscales a photo', () => {
    expect(resizeGeometry(1500)).toBe('1500x1500>');
  });
});
