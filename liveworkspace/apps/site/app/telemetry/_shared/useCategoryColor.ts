'use client';

import { useCallback } from 'react';
import { useAppearance } from '@livediagram/ui';
import { useTelemetryApp } from './app';
import { categoryColor } from './event-vocab';

// The app's category colours as painted right now: the light hues, or in dark
// the same hues lifted to read on the dark card (appearance-colours). Stable
// per app and appearance, so a memo can depend on it.
export function useCategoryColor(): (category: string) => string {
  const { appearance } = useAppearance();
  const { categoryColors } = useTelemetryApp();
  return useCallback(
    (category: string) => categoryColor(categoryColors, category, appearance),
    [categoryColors, appearance],
  );
}
