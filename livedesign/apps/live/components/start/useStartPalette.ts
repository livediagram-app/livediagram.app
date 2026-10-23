import { useOptionalEditorContext } from '@/app/design/[id]/EditorContext';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { getTheme, resolveTabBackdrop } from '@/lib/themes';
import { startPalette, startPanelColours, type StartPalette } from './start-palette';

// The active tab's colours for its start panel and the tours (start-palette.ts), in its light or dark surface.
// Outside an editor there is no tab: the app's own light or dark look.
export function useStartPalette(): StartPalette {
  const surface = useCanvasSurface();
  // Outside an editor (a surface mounted on its own, as some tests mount a tour) there is no tab.
  const tab = useOptionalEditorContext()?.activeTab;
  if (!tab) return startPalette(surface, {});
  // The paper is the tab's canvas as this viewer sees it (its theme's half, docs/specs/011-theme/light-and-dark.md).
  const paper = resolveTabBackdrop(tab).backgroundColor;
  return startPalette(surface, startPanelColours({ backgroundColor: paper }, getTheme(tab.theme)));
}
