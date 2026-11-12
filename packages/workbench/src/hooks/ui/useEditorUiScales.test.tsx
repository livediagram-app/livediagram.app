// @vitest-environment jsdom
// The editor view's UI scales (docs/specs/007-editor/ui-scale.md): the preference, a dragged slider's patch over
// it, and 1 on a phone.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setUiScalePreview } from '../../lib/ui-scale-preview';
import { useEditorUiScales } from './useEditorUiScales';

function mockViewport(phone: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: phone,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

afterEach(() => {
  setUiScalePreview(null);
  vi.unstubAllGlobals();
});

describe('useEditorUiScales', () => {
  it('resolves the preference on a desktop, and a dragged patch over it', () => {
    mockViewport(false);
    const { result } = renderHook(() => useEditorUiScales({ uiScale: 1.1 }));
    expect(result.current.isMobileViewport).toBe(false);
    expect(result.current.uiScales.panels).toBeCloseTo(1.1);
    act(() => setUiScalePreview({ uiScale: 0.9 }));
    expect(result.current.uiScales.panels).toBeCloseTo(0.9);
  });

  it('is 1 on a phone', () => {
    mockViewport(true);
    const { result } = renderHook(() => useEditorUiScales({ uiScale: 1.2 }));
    expect(result.current).toEqual({
      uiScales: { panels: 1, toolbar: 1, cornerButtons: 1 },
      isMobileViewport: true,
    });
  });
});
