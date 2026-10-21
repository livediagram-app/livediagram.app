import { describe, expect, it } from 'vitest';
import { carryLensQuery, readLensQuery, withLensQuery } from './url';

describe('readLensQuery', () => {
  it('reads q, with or without the question mark', () => {
    expect(readLensQuery('?id=1&q=board%3Akanban+plan')).toBe('board:kanban plan');
    expect(readLensQuery('q=plan')).toBe('plan');
  });

  it('reads no q as the empty lens', () => {
    expect(readLensQuery('')).toBe('');
    expect(readLensQuery('?id=1')).toBe('');
  });
});

describe('withLensQuery', () => {
  it('writes the normalised string and keeps every other parameter', () => {
    expect(withLensQuery('?id=1', '  plan   board:kanban ')).toBe('?id=1&q=plan+board%3Akanban');
  });

  it('replaces an existing q in place', () => {
    expect(withLensQuery('?q=old&id=1', 'new')).toBe('?q=new&id=1');
  });

  it('removes q when the lens is empty', () => {
    expect(withLensQuery('?id=1&q=plan', '   ')).toBe('?id=1');
    expect(withLensQuery('?q=plan', '')).toBe('');
  });
});

describe('carryLensQuery', () => {
  it('carries the lens between aggregate views only', () => {
    expect(carryLensQuery('made-by:ai', 'aggregate', 'aggregate')).toBe('made-by:ai');
    expect(carryLensQuery('made-by:ai', 'aggregate', 'scoped')).toBe('');
    expect(carryLensQuery('made-by:ai', 'scoped', 'aggregate')).toBe('');
    expect(carryLensQuery('made-by:ai', 'scoped', 'scoped')).toBe('');
  });
});
