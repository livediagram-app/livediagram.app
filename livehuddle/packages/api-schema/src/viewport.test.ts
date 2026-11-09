import { describe, expect, it } from 'vitest';
import { parseViewport } from './viewport';

// docs/specs/012-collaboration/follow-me-viewport.md: a peer's camera, checked before anyone applies it.

const good = { kind: 'viewport', tabId: 't', pan: { x: -10, y: 20 }, zoom: 1.5 };

describe('parseViewport', () => {
  it('keeps a well-formed camera, its own fields alone', () => {
    expect(parseViewport({ ...good, extra: 'x' })).toEqual(good);
    const size = { width: 1280, height: 720 };
    expect(parseViewport({ ...good, size })).toEqual({ ...good, size });
  });

  it('leaves out a size that does not check, as from a client before sizes', () => {
    expect(parseViewport({ ...good, size: { width: 0, height: 720 } })).toEqual(good);
    expect(parseViewport({ ...good, size: { width: Number.NaN, height: 1 } })).toEqual(good);
    expect(parseViewport({ ...good, size: 'big' })).toEqual(good);
  });

  it('refuses a camera that would send a follower to a blank view', () => {
    for (const zoom of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
      expect(parseViewport({ ...good, zoom })).toBeNull();
    }
    expect(parseViewport({ ...good, pan: { x: '1', y: 0 } })).toBeNull();
    expect(parseViewport({ ...good, pan: null })).toBeNull();
    expect(parseViewport({ ...good, tabId: '' })).toBeNull();
    expect(parseViewport({ ...good, tabId: 'x'.repeat(129) })).toBeNull();
    expect(parseViewport({ ...good, kind: 'avatar' })).toBeNull();
    expect(parseViewport(null)).toBeNull();
  });
});
