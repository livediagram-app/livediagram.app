import { ViewZoomControls } from '@/components/canvas/view-readers';
import { votesSpentBy } from '@livediagram/document';
import { participantKey } from '@/lib/identity';
import type { useVoteReviewOpener } from '@/hooks/canvas/useVoteReviewOpener';
import { OffscreenContentHint } from '@liveworkspace/workbench/components/canvas/OffscreenContentHint';
import {
  SessionClusterStrip,
  sessionStripTools,
  stripCanStart,
} from '@/components/canvas/SessionClusterStrip';
import { LayersThemeStrip } from '@/components/canvas/LayersThemeStrip';
import { tidyUpOffered } from '@/components/canvas/tidy-up-actions';
import { UndoRedoClusterStrip } from '@liveworkspace/workbench/components/canvas/UndoRedoClusterStrip';
import { atLeastInset } from '@livediagram/ui';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { PHONE_CLUSTER_BUTTON_WIDTH } from '@/components/chrome/phone-toolbar-items';
import { CollaborateClusterButton } from '@liveworkspace/workbench/components/canvas/CollaborateClusterButton';
import { kindCounts } from '@liveworkspace/workbench/components/panels/collaborate/collaborate-model';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import type { CanvasChromeProps } from './CanvasChrome.types';

type CanvasCornerClusterProps = {
  props: CanvasChromeProps;
  // What CanvasChrome works out once and shares with the rest of its chrome.
  stripTools: ReturnType<typeof sessionStripTools>;
  voteButtonRef: ReturnType<typeof useVoteReviewOpener>;
  panelsOn: { layers: boolean; collaborate: boolean };
  whiteboard: boolean;
  isMobile: boolean;
  cornerScale: number;
};

// The canvas's bottom-right cluster, split out of CanvasChrome.tsx: Undo / Redo, the Session strip,
// Collaborate, the Layers and Theme strip and the Zoom controls, one row at the corner.
export function CanvasCornerCluster({
  props,
  stripTools,
  voteButtonRef,
  panelsOn,
  whiteboard,
  isMobile,
  cornerScale,
}: CanvasCornerClusterProps) {
  const {
    welcomeOpen,
    offscreenContent,
    onFitToScreen,
    zenMode,
    readOnly,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    selfParticipant,
    activeDockPanel,
    handleDockButtonClick,
    commentRows,
    actionRows,
    onOpenCanvasTheme,
    canvasThemeOpen,
    handleZoomIn,
    handleZoomOut,
    handleSetZoom,
    canvasTool,
    onIsoOrbit,
    onIsoReset,
    onToggleZen,
  } = props;
  // Bottom-right cluster. Order, left to right: the Undo / Redo
  // strip, the Session strip (Timer, Vote, Poll), the
  // Collaborate button (only while the tab has a thread or an action), the Layers and
  // Theme & Canvas strip, then the Zoom controls. The buttons open their panels as popovers
  // above them (docs/specs/007-editor/editor-app.md).
  return (
    <div
      // Presenting hides this cluster (docs/specs/012-collaboration/presentation-mode.md): zen keeps the zoom controls
      // as its one way back out, and a deck has its own way out plus no
      // zoom to offer.
      data-zoom-cluster=""
      data-region="controls"
      // Drawn at the UI scale, still 16px from the corner, or clear of a landscape notch.
      style={
        cornerScale === 1
          ? { right: atLeastInset('16px', 'right') }
          : {
              ...uiScaleStyle(cornerScale),
              right: atLeastInset(`${toSurfacePx(16, cornerScale)}px`, 'right'),
              bottom: toSurfacePx(16, cornerScale),
            }
      }
      // On a phone the cluster stays one row (docs/specs/012-collaboration/session-tools.md "The Session
      // strip"): its buttons share the width there is, PHONE_CLUSTER_BUTTON_WIDTH, from 36px up to their
      // usual 44px (always 44px tall to tap), so Undo, the Session strip, Layers and Theme and Fit fill the
      // row on a 360px screen and up. It may still wrap, from the right, on a narrower one, so Undo is never
      // pushed off the screen.
      className={`pointer-events-none absolute bottom-4 right-4 z-[var(--z-panel)] flex items-center gap-2 phone:left-4 phone:flex-wrap phone:justify-end phone:gap-1.5 ${PHONE_CLUSTER_BUTTON_WIDTH} ${PHONE_TOOLBAR_ITEMS}`}
    >
      {welcomeOpen ? null : (
        <>
          {offscreenContent ? <OffscreenContentHint onBringBack={onFitToScreen} /> : null}
          {/* Undo / Redo: see UndoRedoClusterStrip. A Participant undoes its own changes too
              (docs/specs/013-workspace/share-roles.md). */}
          {!zenMode && (!readOnly || !!props.participantPalette) ? (
            <UndoRedoClusterStrip
              onUndo={onUndo}
              onRedo={onRedo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          ) : null}
          {/* The Session strip (docs/specs/012-collaboration/session-tools.md "The Session strip"): left of
              Layers. Kept in Zen: a running session is the one piece of chrome a facilitator still
              needs there. Workshop (and an event-storming board) has all three; Diagram and Draw keep
              their bottom bar to their own tools. */}
          {props.sessionTools && stripTools ? (
            <div className="contents">
              <SessionClusterStrip
                timer={props.sessionTools.timer}
                voteRunning={!!props.tabVote}
                voteDotsLeft={
                  // A Participant votes too (docs/specs/013-workspace/share-roles.md), so it sees its dots left.
                  props.tabVote?.active && (!readOnly || props.takePart)
                    ? Math.max(
                        0,
                        props.tabVote.votesPerPerson -
                          votesSpentBy(props.tabVote, participantKey(selfParticipant)),
                      )
                    : null
                }
                voteReviewing={!!props.voteReview}
                voteButtonRef={voteButtonRef}
                pollRunning={!!props.pollPanel}
                canStart={stripCanStart(!!readOnly)}
                offersTimer={stripTools.timer}
                offersPoll={stripTools.poll}
                open={
                  activeDockPanel === 'session-timer' ||
                  activeDockPanel === 'session-vote' ||
                  activeDockPanel === 'session-poll'
                    ? activeDockPanel
                    : null
                }
                onToggle={(segment, button) => handleDockButtonClick(segment, button, true)}
              />
            </div>
          ) : null}
          {/* Collaborate (docs/specs/012-collaboration/assigned-actions.md §5): before Layers, only while
              the tab has a comment thread or an action. A view-role visitor
              gets it too: they read threads and answer them. */}
          {!zenMode && panelsOn.collaborate && (commentRows.length > 0 || actionRows.length > 0) ? (
            <CollaborateClusterButton
              openCount={kindCounts('open', commentRows, actionRows).all}
              popoverOpen={activeDockPanel === 'collaborate'}
              onTogglePopover={(button) => handleDockButtonClick('collaborate', button, true)}
            />
          ) : null}
          {/* Layers (docs/specs/006-document/layers.md) and the Theme & Canvas brush
              (docs/specs/011-theme/canvas-and-theme-dialog.md, its one entry point; read-only sessions
              pass no handler), one strip in every mode: see LayersThemeStrip. */}
          {!zenMode ? (
            <LayersThemeStrip
              // Tidy Up, first in the strip (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up button").
              tidyUp={
                tidyUpOffered({
                  actions: props.tidyUp,
                  editorMode: props.editorMode,
                  zenMode: !!zenMode,
                })
                  ? {
                      open: activeDockPanel === 'tidy-up',
                      onToggle: (button) => handleDockButtonClick('tidy-up', button, true),
                    }
                  : undefined
              }
              layers={
                !readOnly && panelsOn.layers
                  ? {
                      open: activeDockPanel === 'layers',
                      onToggle: (button) => handleDockButtonClick('layers', button, true),
                    }
                  : undefined
              }
              onOpenTheme={onOpenCanvasTheme && !whiteboard ? onOpenCanvasTheme : undefined}
              themeOpen={!!canvasThemeOpen}
            />
          ) : null}
          <ViewZoomControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onSetZoom={handleSetZoom}
            onFitToScreen={onFitToScreen}
            onIsoOrbit={canvasTool === 'isometric' ? onIsoOrbit : undefined}
            onIsoReset={canvasTool === 'isometric' ? onIsoReset : undefined}
            onToggleZen={onToggleZen}
            zenActive={zenMode}
            // View-only visitors have no palette (so no canvas-tool
            // dropdown); the dock keeps the enter button for them.
            zenEnterHere={readOnly}
            pinchOnly={isMobile}
          />
        </>
      )}
    </div>
  );
}
