// @vitest-environment jsdom

// docs/specs/006-project/save-locations.md "The default": /new stores every new plan on liveplanner, a guest's
// included, without waiting for sign-in.

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNewProjectLocation } from './useNewProjectLocation';

describe('useNewProjectLocation', () => {
  it('stores every new plan on liveplanner', async () => {
    const { result } = renderHook(() => useNewProjectLocation());
    await expect(result.current.resolveSaveLocation()).resolves.toBe('liveplanner');
  });
});
