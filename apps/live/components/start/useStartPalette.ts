import { planPalette, type PlanPalette } from '@livediagram/document';
import { useEditorContext, type EditorContextValue } from '@/app/document/[id]/EditorContext';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { getTheme } from '@/lib/themes';
import { startPanelColours } from './start-palette';

// The editor around this surface, or none (a surface mounted on its own, as some tests mount a tour). The hook is
// always called, so the rule of hooks holds; only its "no editor" error is caught.
function useEditorIfAny(): Partial<EditorContextValue> | null {
  try {
    return useEditorContext();
  } catch {
    return null;
  }
}

// The active tab's colours for its start panel and the tours (start-palette.ts), in its light or dark surface.
// Outside an editor there is no tab: the app's own light or dark look.
export function useStartPalette(): PlanPalette {
  const surface = useCanvasSurface();
  const tab = useEditorIfAny()?.activeTab;
  return planPalette(surface, tab ? startPanelColours(tab, getTheme(tab.theme)) : {});
}
