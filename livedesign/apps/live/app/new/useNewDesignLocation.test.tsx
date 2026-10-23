// @vitest-environment jsdom

// docs/specs/006-design/save-locations.md "The default": /new stores every new design on livedesign, a guest's
// included, without waiting for sign-in.

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNewDesignLocation } from './useNewDesignLocation';

describe('useNewDesignLocation', () => {
  it('stores every new design on livedesign', async () => {
    const { result } = renderHook(() => useNewDesignLocation());
    await expect(result.current.resolveSaveLocation()).resolves.toBe('livedesign');
  });
});
