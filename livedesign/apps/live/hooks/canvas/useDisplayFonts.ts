'use client';

// The display faces a tab's elements use, linked as they appear (docs/specs/004-interface-design/fonts.md "The
// display library"): a collaborator's choice arrives with the element, and useFontEpoch re-measures once it lands.
import { useEffect } from 'react';
import { displayFontIdsIn, loadDisplayFonts } from '@/lib/display-fonts-loader';

export function useDisplayFonts(elements: readonly { font?: unknown }[]): void {
  useEffect(() => {
    loadDisplayFonts(displayFontIdsIn(elements));
  }, [elements]);
}
