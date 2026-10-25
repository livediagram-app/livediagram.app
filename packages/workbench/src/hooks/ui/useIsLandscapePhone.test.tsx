// @vitest-environment jsdom
// docs/specs/007-editor/editor-app.md "A phone held sideways": the hook answers LANDSCAPE_PHONE_MEDIA_QUERY.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANDSCAPE_PHONE_MEDIA_QUERY } from '../../lib/responsive';
import { useIsLandscapePhone } from './useIsMobileViewport';

afterEach(() => vi.unstubAllGlobals());

const matching = (match: string) =>
  vi.fn((query: string) => ({
    matches: query === match,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

describe('useIsLandscapePhone', () => {
  it('is true on a phone held sideways', () => {
    vi.stubGlobal('matchMedia', matching(LANDSCAPE_PHONE_MEDIA_QUERY));
    expect(renderHook(() => useIsLandscapePhone()).result.current).toBe(true);
  });

  it('is false anywhere else', () => {
    vi.stubGlobal('matchMedia', matching('(max-width: 639px)'));
    expect(renderHook(() => useIsLandscapePhone()).result.current).toBe(false);
  });
});
