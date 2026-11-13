import { describe, expect, it } from 'vitest';
import { isCollabKey } from '@liveworkspace/api-schema/collab-key';
import { isVisitorSecret, visitorCollabKey } from './visitor-key';

// docs/specs/013-workspace/share-roles.md "The collab key" (Work Tracker 730).
describe('visitor keys', () => {
  it('takes a UUID-like secret and nothing else', () => {
    expect(isVisitorSecret('0f8e6a2c-1b3d-4e5f-8a9b-0c1d2e3f4a5b')).toBe(true);
    expect(isVisitorSecret('ABCDEFabcdef0123')).toBe(true);
    for (const bad of [
      undefined,
      42,
      '',
      'short',
      'x'.repeat(65),
      'has space in it!!',
      'émoji-émoji-émoji',
    ])
      expect(isVisitorSecret(bad)).toBe(false);
  });

  it('derives one collab key per secret, the same every time', () => {
    const a = visitorCollabKey('0f8e6a2c-1b3d-4e5f-8a9b-0c1d2e3f4a5b');
    expect(isCollabKey(a)).toBe(true);
    expect(visitorCollabKey('0f8e6a2c-1b3d-4e5f-8a9b-0c1d2e3f4a5b')).toBe(a);
    expect(visitorCollabKey('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d')).not.toBe(a);
  });
});
