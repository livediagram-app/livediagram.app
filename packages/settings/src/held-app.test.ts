import { describe, expect, it } from 'vitest';
import { DEVICE_PREFERENCES } from './device';
import { isPushDeviceApp, PUSH_DEVICE_APPS } from './push';

// livehuddle, registered before its launch (liveworkspace/docs/specs/002-architecture/integrating-an-app.md): its
// editor's browser keys are known, and a phone it turns notifications on in is accepted.
describe('livehuddle in settings', () => {
  it('keeps its settings under its own browser keys', () => {
    expect(DEVICE_PREFERENCES['livehuddle.app']).toEqual({
      storageKey: 'livehuddle:user-preferences:v1',
      unsyncedKey: 'livehuddle:user-preferences:unsynced',
    });
  });

  it('is where a phone may be turned on', () => {
    expect(PUSH_DEVICE_APPS).toContain('livehuddle');
    expect(isPushDeviceApp('livehuddle')).toBe(true);
    expect(isPushDeviceApp('livenope')).toBe(false);
  });
});
