import { describe, expect, it } from 'vitest';
import { APP_KINDS, APPS, isApp, KINDS } from './constants';

// livehuddle, registered before its launch (liveworkspace/docs/specs/002-architecture/integrating-an-app.md).
describe('livehuddle in the index', () => {
  it('is an app, making Spaces, after the four it joins', () => {
    expect(APPS).toEqual([
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
    ]);
    expect(isApp('livehuddle')).toBe(true);
    expect(APP_KINDS.livehuddle).toBe('space');
    expect(KINDS).toContain('space');
  });

  it('leaves the other apps their own kinds', () => {
    expect(APP_KINDS).toMatchObject({
      livediagram: 'canvas',
      liveplanner: 'plan',
      livedocuments: 'document',
      livedesign: 'design',
    });
    expect(isApp('livenope')).toBe(false);
  });
});
