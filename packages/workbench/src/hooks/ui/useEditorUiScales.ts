'use client';

import { useUiScalePreview } from '../../components/providers/ui-scale';
import { resolveUiScales, type UiScalePreferences, type UiScales } from '../../lib/ui-scale';
import { useIsMobileViewport } from './useIsMobileViewport';

// The editor view's UI scales (docs/specs/007-editor/ui-scale.md): desktop only, so a phone resolves to 1.
// While a Settings slider is dragged its patch wins, so the chrome resizes
// as you go; the preference is written once, on release. Resolved on every render, as each editor's view did,
// and handed back with whether the viewport is a phone's, which the view reads too.
export function useEditorUiScales(userPreferences: UiScalePreferences): {
  uiScales: UiScales;
  isMobileViewport: boolean;
} {
  const uiScalePreview = useUiScalePreview();
  const isMobileViewport = useIsMobileViewport();
  const uiScales = resolveUiScales(
    uiScalePreview === null ? userPreferences : { ...userPreferences, ...uiScalePreview },
    { mobile: isMobileViewport },
  );
  return { uiScales, isMobileViewport };
}
