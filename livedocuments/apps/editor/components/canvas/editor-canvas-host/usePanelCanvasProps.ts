import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { track } from '@/lib/telemetry';

// The Canvas props for the floating panels and docks (EditorCanvasHost): the minimap, the laser,
// spotlight and format panels, Theme & canvas, and the Collaborate panel's comment and action rows.
export function usePanelCanvasProps({
  goToRowElement,
}: {
  // A Collaborate panel row goes to its card, brought into view.
  goToRowElement: (id: string) => void;
}) {
  const {
    laserPanelPosition,
    spotlightPanelPosition,
    setSpotlightPanelPosition,
    formatConfig,
    onToggleFormatGroup,
    onSetFormatMode,
    formatPanelPosition,
    setFormatPanelPosition,
    laserConfig,
    onChangeLaserField,
    setLaserPanelPosition,
    actionRows,
    commentRows,
    commentsPanelPosition,
    embedMode,
    isReadOnly,
    mapPosition,
    openActionPopover,
    completeAction,
    reopenAction,
    openComments,
    setCanvasThemeTab,
    setCommentsPanelPosition,
    setMapPosition,
  } = useEditorContext();
  return {
    mapPosition,
    onMoveMap: (x: number, y: number) =>
      // Equality-guarded so a drag tick that resolves to the same spot
      // doesn't spin the render loop (max update depth).
      setMapPosition((p) => (p && p.x === x && p.y === y ? p : { x, y })),
    onResetMap: () => setMapPosition((p) => (p === null ? p : null)),
    laserPanelPosition,
    spotlightPanelPosition,
    formatConfig,
    onToggleFormatGroup,
    onSetFormatMode,
    formatPanelPosition,
    onMoveFormatPanel: (x: number, y: number) => setFormatPanelPosition({ x, y }),
    onResetFormatPanel: () => setFormatPanelPosition(null),
    onMoveSpotlightPanel: (x: number, y: number) => setSpotlightPanelPosition({ x, y }),
    onResetSpotlightPanel: () => setSpotlightPanelPosition(null),
    laserConfig,
    onChangeLaserField,
    onMoveLaserPanel: (x: number, y: number) => setLaserPanelPosition({ x, y }),
    onResetLaserPanel: () => setLaserPanelPosition(null),
    // Bottom-dock Theme & canvas button (docs/specs/011-theme/canvas-and-theme-dialog.md): opens the
    // CanvasThemeDialog on its home (Page Design while the tab has pages). Named Style, by the zoom as in the
    // other apps (owner, 2026-11-25); the pages' title bars no longer hold it.
    onOpenCanvasTheme:
      isReadOnly || embedMode
        ? undefined
        : () => {
            setCanvasThemeTab('looks');
            track('UI', 'Opened', 'ThemePicker');
          },
    commentRows,
    commentsPanelPosition,
    onMoveCommentsPanel: (x: number, y: number) => setCommentsPanelPosition({ x, y }),
    onResetCommentsPanel: () => setCommentsPanelPosition(null),
    onOpenCommentsForElement: (id: string) => {
      goToRowElement(id);
      openComments(id);
    },
    actionRows,
    onOpenActionForElement: (id: string) => {
      goToRowElement(id);
      openActionPopover(id);
    },
    onToggleActionDone: isReadOnly
      ? undefined
      : (id: string, done: boolean) => (done ? completeAction(id) : reopenAction(id)),
  };
}
