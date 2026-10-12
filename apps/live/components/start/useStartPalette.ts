import { mixHex, planPalette, type PlanPalette } from '@livediagram/document';
import { useEditorContext, type EditorContextValue } from '@/app/document/[id]/EditorContext';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { getTheme, resolveTabBackdrop } from '@/lib/themes';
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

/** How much of the theme's accent a start panel's lines keep, mixed into its paper. */
const START_BORDER_SHARE = 0.3;

// The active tab's colours for its start panel and the tours (start-palette.ts), in its light or dark surface.
// Outside an editor there is no tab: the app's own light or dark look.
export function useStartPalette(): PlanPalette {
  const surface = useCanvasSurface();
  const tab = useEditorIfAny()?.activeTab;
  if (!tab) return planPalette(surface, {});
  // The paper is the tab's canvas as this viewer sees it (its theme's half, docs/specs/011-theme/light-and-dark.md).
  const paper = resolveTabBackdrop(tab).backgroundColor;
  const palette = planPalette(
    surface,
    startPanelColours({ backgroundColor: paper }, getTheme(tab.theme)),
  );
  // A board's border is its accent; on a panel this size that reads heavy, so its lines take a quiet mix of the
  // accent into the paper (START_BORDER_SHARE) and the full accent stays for hover and focus.
  if (palette.border === palette.focus) {
    const border = mixHex(palette.border, palette.surface, START_BORDER_SHARE);
    return { ...palette, border, cardBorder: mixHex(border, palette.surface, 0.7) };
  }
  return palette;
}
