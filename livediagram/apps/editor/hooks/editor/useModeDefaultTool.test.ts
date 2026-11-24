// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FINE_POINTER_MEDIA_QUERY,
  PHONE_MEDIA_QUERY,
  TOUCH_FIRST_MEDIA_QUERY,
} from '@liveworkspace/workbench/lib/responsive';
import { modeDefaultTool, startsOnHand } from './useModeDefaultTool';

const before = window.matchMedia;
// A device answering these media queries.
const device = (matching: readonly string[]) => {
  window.matchMedia = vi.fn((q: string) => ({ matches: matching.includes(q) }) as MediaQueryList);
};
afterEach(() => {
  window.matchMedia = before;
});

// docs/specs/007-editor/editor-modes.md "The tool a mode starts with".
describe('modeDefaultTool', () => {
  it('starts on Select, and on Hand where a finger is the way in', () => {
    expect(modeDefaultTool(false)).toBe('select');
    expect(modeDefaultTool(true)).toBe('pan');
  });
});

describe('startsOnHand', () => {
  it('starts an iPad or tablet worked by finger on Hand', () => {
    device([TOUCH_FIRST_MEDIA_QUERY]);
    expect(modeDefaultTool(startsOnHand())).toBe('pan');
  });

  it('starts a phone on Hand', () => {
    device([PHONE_MEDIA_QUERY, TOUCH_FIRST_MEDIA_QUERY]);
    expect(modeDefaultTool(startsOnHand())).toBe('pan');
  });

  it('keeps Select with a trackpad or mouse attached to an iPad, on a touchscreen laptop and on a desktop', () => {
    device([TOUCH_FIRST_MEDIA_QUERY, FINE_POINTER_MEDIA_QUERY]);
    expect(modeDefaultTool(startsOnHand())).toBe('select');
    device([FINE_POINTER_MEDIA_QUERY]);
    expect(modeDefaultTool(startsOnHand())).toBe('select');
  });
});
