import { describe, expect, it } from 'vitest';
import { isComposingKey } from './composing-key';

describe('isComposingKey', () => {
  it('is the input method’s while it composes, through a React event or a DOM one', () => {
    expect(isComposingKey({ nativeEvent: { isComposing: true, keyCode: 13 } })).toBe(true);
    expect(isComposingKey({ isComposing: true, keyCode: 13 })).toBe(true);
  });

  it('counts Safari’s confirming Enter, which arrives after the composition ended', () => {
    expect(isComposingKey({ nativeEvent: { isComposing: false, keyCode: 229 } })).toBe(true);
    expect(isComposingKey({ isComposing: false, keyCode: 229 })).toBe(true);
  });

  it('leaves a plain key to the field', () => {
    expect(isComposingKey({ nativeEvent: { isComposing: false, keyCode: 13 } })).toBe(false);
    expect(isComposingKey({ isComposing: false, keyCode: 27 })).toBe(false);
    expect(isComposingKey({})).toBe(false);
  });
});
