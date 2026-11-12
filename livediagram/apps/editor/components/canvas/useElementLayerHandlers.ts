// The element layer's handler bags (docs/specs/008-canvas/canvas-performance.md): identity-stable wrappers for
// every function prop the memoized element views receive, the per-element timer, comment and action bags built
// from them, and what every boxed view takes from the layer. Hooks CanvasElementsLayer calls in its own order,
// split out of it so its body is the paint order and the drawing.

import { useMemo } from 'react';
import { useStableHandlers } from '@liveworkspace/workbench/hooks/ui/useStableHandlers';
import {
  alignmentCoordinates,
  isSelectionMode,
  laneSeamCoordinates,
  snapSeamCoordinate,
  type CommentMention,
  type LaneGutterEdge,
  type LaneLike,
} from '@livediagram/document';
import { idBound } from './element-layer-props';
import type { BoxedShared } from './CanvasElementList';
import type { CanvasElementsLayerProps } from './CanvasElementsLayer';

export function useElementLayerHandlers(props: CanvasElementsLayerProps) {
  const {
    elements,
    readOnly,
    takePart = false,
    sessionStartBlocked,
    entityActions,
    commentPanelActions,
    actionPanelActions,
    handleArrowSelect,
    handleElementClick,
    handleElementContextSelect,
    onBeginEndpointDrag,
    onBeginEdit,
    onCommitLabel,
    onCancelEdit,
    onBeginArrowTranslate,
    onBeginArrowCurveDrag,
    onBeginArrowCurvePointDrag,
    onBeginArrowBend,
    onBeginArrowScale,
    onDeleteCurvePoint,
    onBeginArrowElbowDrag,
    onBeginArrowLabelDrag,
    onBeginDrag,
    onPressArmedAction,
    onShiftSelect,
    onCastVote,
    onRetractVote,
    onSetTextAlign,
    onCommitTable,
    onCommitHeaderSize,
    onToggleChecklistItem,
    onSetPageHeading,
    onSetWebRows,
    onSetPointerTip,
    onSetHeroCaptionLine,
    onFollowLink,
    onPressModeButton,
    onPressFocusButton,
    onPressSessionButton,
    onToggleReveal,
    onRollPicker,
    onOpenComments,
    onOpenAction,
    onOpenNote,
    onEditLink,
    onOpenEditDialog,
    onDropIcon,
    onLinkCell,
    onSetSessionConfig,
    onOpenElementSettings,
    onEnterPortal,
    onFireReaction,
    onReactionBurstDone,
    onPauseTimer,
    onResumeTimer,
    onResetTimer,
    onClearTimer,
    onSetTimerDuration,
  } = props;
  // Identity-stable wrappers for every function prop the memoized
  // element views receive. The editor's orchestration mints fresh
  // closures per render (every drag tick, cursor packet, keystroke), so
  // without this the views' React.memo never fired and dragging ONE
  // element re-rendered all N views at pointer rate. See
  // useStableHandlers; the conditional (read-only) handlers keep their
  // presence/absence so children still branch on them.
  const h = useStableHandlers({
    handleArrowSelect,
    handleElementClick,
    handleElementContextSelect,
    onBeginEndpointDrag,
    onBeginEdit,
    onCommitLabel,
    onCancelEdit,
    onBeginArrowTranslate,
    onBeginArrowCurveDrag,
    onBeginArrowCurvePointDrag,
    onBeginArrowBend,
    onBeginArrowScale,
    onDeleteCurvePoint,
    onBeginArrowElbowDrag,
    onBeginArrowLabelDrag,
    onBeginDrag,
    onPressArmedAction,
    onShiftSelect,
    // Voting is taking part: a Participant's as well as an Editor's (docs/specs/013-workspace/share-roles.md).
    onCastVote: readOnly && !takePart ? undefined : onCastVote,
    onRetractVote: readOnly && !takePart ? undefined : onRetractVote,
    onSetTextAlign: readOnly ? undefined : onSetTextAlign,
    onCommitTable,
    onCommitHeaderSize: readOnly ? undefined : onCommitHeaderSize,
    // The seam's snap targets (docs/specs/009-elements/lane.md). Resolved here because this is where
    // the sibling elements are: BoxedElementView only ever sees its own.
    onSnapSeam: readOnly
      ? undefined
      : (
          candidate: number,
          axis: 'x' | 'y',
          excludeId: string,
          edgeOf: (el: LaneLike) => LaneGutterEdge,
          sizeOf: (el: LaneLike) => number,
        ) =>
          snapSeamCoordinate(candidate, {
            seams: laneSeamCoordinates(elements, axis, excludeId, edgeOf, sizeOf),
            alignment: alignmentCoordinates(elements, axis, excludeId),
          }).value,
    onToggleChecklistItem: readOnly ? undefined : onToggleChecklistItem,
    onSetEntityFields: readOnly ? undefined : entityActions?.setFields,
    onStartFieldArrow: readOnly ? undefined : entityActions?.startFieldArrow,
    onAddEntityField: readOnly ? undefined : entityActions?.addFieldSelected,
    onAddRelatedEntity: readOnly ? undefined : entityActions?.addRelatedSelected,
    onSetPageHeading,
    onSetWebRows: readOnly ? undefined : onSetWebRows,
    onSetPointerTip: readOnly ? undefined : onSetPointerTip,
    onSetHeroCaptionLine: readOnly ? undefined : onSetHeroCaptionLine,
    onFollowLink,
    onPressModeButton,
    onPressFocusButton,
    onPressSessionButton,
    onToggleReveal,
    onRollPicker,
    onOpenComments,
    onOpenAction,
    onOpenNote,
    onEditLink,
    onOpenEditDialog,
    onDropIcon,
    onLinkCell,
    // docs/specs/008-canvas/canvas-performance.md: the rest of what each view receives, stable too.
    onSetSessionConfig,
    onOpenElementSettings,
    onEnterPortal,
    onFireReaction,
    onReactionBurstDone,
    onPauseTimer,
    onResumeTimer,
    onResetTimer,
    onClearTimer,
    onSetTimerDuration,
    commentAdd: commentPanelActions?.add,
    commentRemove: commentPanelActions?.remove,
    commentResolve: commentPanelActions?.resolve,
    commentUnresolve: commentPanelActions?.unresolve,
    actionConfigure: actionPanelActions?.configure,
    actionComplete: actionPanelActions?.complete,
    actionReopen: actionPanelActions?.reopen,
  });
  // One timer bag and one comment / action bag per element, built from the stable wrappers above, so
  // a view's memo holds across editor renders (docs/specs/008-canvas/canvas-performance.md).
  // Running the timer is the session's runner's (docs/specs/013-workspace/share-roles.md, facilitator.md): a
  // Participant, a Viewer and anyone but the facilitator see the face without its controls.
  const timerControls = useMemo(
    () =>
      sessionStartBlocked
        ? {}
        : {
            pause: h.onPauseTimer,
            resume: h.onResumeTimer,
            reset: h.onResetTimer,
            clear: h.onClearTimer,
            setDuration: h.onSetTimerDuration,
          },
    [h, sessionStartBlocked],
  );
  const commentActionsFor = useMemo(() => {
    const { commentAdd, commentRemove, commentResolve, commentUnresolve } = h;
    if (!commentAdd || !commentRemove || !commentResolve || !commentUnresolve) return null;
    return idBound((id) => ({
      add: (text: string, mentions: CommentMention[]) => commentAdd(id, text, mentions),
      remove: (commentId: string) => commentRemove(id, commentId),
      resolve: () => commentResolve(id),
      unresolve: () => commentUnresolve(id),
    }));
  }, [h]);
  const actionActionsFor = useMemo(() => {
    const { actionConfigure, actionComplete, actionReopen } = h;
    if (!actionConfigure || !actionComplete || !actionReopen) return null;
    return idBound((id) => ({
      add: () => actionConfigure(id, null),
      edit: (actionId: string) => actionConfigure(id, actionId),
      complete: (actionId: string) => actionComplete(id, actionId),
      reopen: (actionId: string) => actionReopen(id, actionId),
    }));
  }, [h]);
  return { h, timerControls, commentActionsFor, actionActionsFor };
}

type LayerHandlers = ReturnType<typeof useElementLayerHandlers>;

// What every boxed element view takes from this layer, the same for each element.
export function useBoxedShared({
  h,
  timerControls,
  isPaintMode,
  tabLocked,
  tabSummaries,
  readOnly,
  tabVote,
  selfId,
  voteMax,
  voteReview,
  stablePalette,
  sessionStartBlocked,
  sessionRunBy,
  timerState,
  tabTimer,
  commentSelfId,
  actionSelfId,
  collab,
  canvasTool,
  imageContext,
}: Pick<
  CanvasElementsLayerProps,
  | 'isPaintMode'
  | 'tabLocked'
  | 'tabSummaries'
  | 'readOnly'
  | 'tabVote'
  | 'voteReview'
  | 'sessionStartBlocked'
  | 'sessionRunBy'
  | 'timerState'
  | 'tabTimer'
  | 'commentSelfId'
  | 'actionSelfId'
  | 'collab'
  | 'canvasTool'
  | 'imageContext'
> &
  Pick<LayerHandlers, 'h' | 'timerControls'> & {
    selfId: string;
    voteMax: number;
    stablePalette: CanvasElementsLayerProps['chartPalette'];
  }): BoxedShared {
  return useMemo<BoxedShared>(
    () => ({
      onPlainClick: h.handleElementClick,
      isPaintMode,
      tabLocked,
      tabSummaries,
      readOnly,
      onBeginDrag: h.onBeginDrag,
      onPressArmedAction: h.onPressArmedAction,
      onShiftSelect: h.onShiftSelect,
      vote: tabVote,
      selfId,
      voteMax,
      voteReviewActive: voteReview != null,
      onCastVote: h.onCastVote,
      onRetractVote: h.onRetractVote,
      onBeginEdit: h.onBeginEdit,
      onCommitLabel: h.onCommitLabel,
      onSetTextAlign: h.onSetTextAlign,
      onCommitTable: h.onCommitTable,
      onCommitHeaderSize: h.onCommitHeaderSize,
      onSnapSeam: h.onSnapSeam,
      onToggleChecklistItem: h.onToggleChecklistItem,
      onSetEntityFields: h.onSetEntityFields,
      onStartFieldArrow: h.onStartFieldArrow,
      onSetPageHeading: h.onSetPageHeading,
      onSetWebRows: h.onSetWebRows,
      onSetPointerTip: h.onSetPointerTip,
      onSetHeroCaptionLine: h.onSetHeroCaptionLine,
      chartPalette: stablePalette,
      onCancelEdit: h.onCancelEdit,
      onFollowLink: h.onFollowLink,
      onPressModeButton: h.onPressModeButton,
      onPressFocusButton: h.onPressFocusButton,
      onPressSessionButton: h.onPressSessionButton,
      sessionStartBlocked,
      sessionRunBy,
      timerState,
      tabTimer: tabTimer ?? null,
      onSetSessionConfig: h.onSetSessionConfig,
      onOpenElementSettings: h.onOpenElementSettings,
      commentSelfId,
      actionSelfId,
      timerControls,
      onToggleReveal: h.onToggleReveal,
      onRollPicker: h.onRollPicker,
      collab,
      // Mode Buttons light up for the mode they hand out, and the canvas-tool union is WIDER than the mode
      // vocabulary: Slide Deck (docs/specs/012-collaboration/presentation-mode.md) has no Mode Button, so it is not a
      // SelectionMode. Narrow rather than widen: a "Switch to Slide Deck" button is exactly what that spec rules out.
      activeMode: isSelectionMode(canvasTool) ? canvasTool : undefined,
      onEnterPortal: h.onEnterPortal,
      onFireReaction: h.onFireReaction,
      onReactionBurstDone: h.onReactionBurstDone,
      onOpenComments: h.onOpenComments,
      onOpenAction: h.onOpenAction,
      onOpenNote: h.onOpenNote,
      onEditLink: h.onEditLink,
      onOpenEditDialog: h.onOpenEditDialog,
      onDropIcon: h.onDropIcon,
      onLinkCell: h.onLinkCell,
      imageContext,
      onContextSelect: h.handleElementContextSelect,
    }),
    [
      h,
      isPaintMode,
      tabLocked,
      tabSummaries,
      readOnly,
      tabVote,
      selfId,
      voteMax,
      voteReview,
      stablePalette,
      sessionStartBlocked,
      sessionRunBy,
      timerState,
      tabTimer,
      commentSelfId,
      actionSelfId,
      timerControls,
      collab,
      canvasTool,
      imageContext,
    ],
  );
}
