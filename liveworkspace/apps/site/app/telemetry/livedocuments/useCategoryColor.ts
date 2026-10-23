'use client';

import { useCallback } from 'react';
import { useAppearance } from '@livediagram/ui';
import { categoryColor } from './event-vocab';

// The category colours as painted right now: the light hues, or in dark the
// same hues lifted to read on the dark card (appearance-colours). Stable per
// appearance, so a memo can depend on it.
export function useCategoryColor(): (category: string) => string {
  const { appearance } = useAppearance();
  return useCallback((category: string) => categoryColor(category, appearance), [appearance]);
}
