// @vitest-environment jsdom

// docs/specs/006-document/save-locations.md "The default": /new stores every new document on livediagram, a guest's
// included, without waiting for sign-in.

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNewDocumentLocation } from './useNewDocumentLocation';

describe('useNewDocumentLocation', () => {
  it('stores every new document on livediagram', async () => {
    const { result } = renderHook(() => useNewDocumentLocation());
    await expect(result.current.resolveSaveLocation()).resolves.toBe('livediagram');
  });
});
