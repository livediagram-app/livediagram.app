import { describe, expect, it } from 'vitest';
import { appFromParam, isAppId } from './app-settings';

describe('app settings', () => {
  it('reads a deep link by site id or name, and nothing else', () => {
    expect(appFromParam('livediagram')).toBe('livediagram.app');
    expect(appFromParam('LiveDesign')).toBe('livedesign.app');
    expect(appFromParam('liveplanner.app')).toBe('liveplanner.app');
    expect(appFromParam('liveworkspace')).toBeNull();
    expect(appFromParam('nope')).toBeNull();
    expect(appFromParam(null)).toBeNull();
    expect(isAppId('toString')).toBe(false);
  });
});
