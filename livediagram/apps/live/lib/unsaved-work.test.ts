import { describe, expect, it } from 'vitest';
import { hasUnsavedWork, registerUnsavedWork } from './unsaved-work';

describe('unsaved work', () => {
  it('is unsaved while any registered source says so, and forgets a source that leaves', () => {
    expect(hasUnsavedWork()).toBe(false);
    let unsaved = true;
    const leave = registerUnsavedWork(() => unsaved);
    const other = registerUnsavedWork(() => false);
    expect(hasUnsavedWork()).toBe(true);
    unsaved = false;
    expect(hasUnsavedWork()).toBe(false);
    unsaved = true;
    leave();
    expect(hasUnsavedWork()).toBe(false);
    other();
  });
});
