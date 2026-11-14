import { defaultFillColor, elementHasText, type ownColours } from '@livediagram/document';
import { LockBadge, SelectionChromeLayer } from '@/components/canvas/element-parts';
import { ShapeHitOutline, type outlineHit } from '@/components/canvas/ShapeHitOutline';
import { ReactionBurst } from '@/components/canvas/ReactionBurst';
import type { describeVariant } from '@/components/canvas/element-variant';
import type { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { PhotoDraftRing, PhotoMatchedBadge } from '@/components/canvas/photo-badges';
import { RemoteSelectorsStrip } from '@/components/canvas/element-badges';
import { ElementIndicators } from '@/components/canvas/ElementIndicators';
import { indicatorBacking } from '@/components/canvas/indicator-items';
import type { useElementIndicators } from '@/components/canvas/useElementIndicators';
import { AnnotationHoverNote } from '@/components/canvas/AnnotationMarker';
import type { useBoxedElementAnimation } from '@/components/canvas/useBoxedElementAnimation';
import { AnimationLayer } from '@liveworkspace/workbench/components/canvas/AnimationLayer';
import { IconDropPreview, type useIconDropTarget } from '@/components/canvas/useIconDropTarget';
import { ElementVoteOverlay } from '@/components/canvas/ElementVoteOverlay';
import type { BoxedElementViewProps } from './BoxedElementView.types';

type Animation = ReturnType<typeof useBoxedElementAnimation>;

// What BoxedElementView works out for its chrome, handed down as it is.
export type BoxedChromeLocals = {
  shapeHit: ReturnType<typeof outlineHit>;
  variant: ReturnType<typeof describeVariant>;
  layer: Animation['layer'];
  layerAnim: Animation['layerAnim'];
  shapeKind: string | undefined;
  cornerPx: number;
  dropSide: ReturnType<typeof useIconDropTarget>['dropSide'];
  indicators: ReturnType<typeof useElementIndicators>;
  own: ReturnType<typeof ownColours>;
  surface: ReturnType<typeof useCanvasSurface>;
  voteHighlighted: boolean;
  rotation: number;
  isAnnotation: boolean;
  hovering: boolean;
};

// What a boxed element draws over its face (BoxedElementView): the outline it is picked by, the animation
// layer, the icon drop preview, a reaction burst, its badges and indicators, the vote marks, the photo
// import's marks, the selection handles and an annotation's hover note. A hook, so the React Compiler
// memoises each part on what it reads, as it did inline.
export function useBoxedElementChrome(
  {
    element,
    reactionBurst,
    onReactionBurstDone,
    remoteSelectors,
    isSelected,
    vote,
    selfId,
    voteMax,
    votableInVote,
    voteReviewActive,
    isVoteFocus,
    onRetractVote,
    onCastVote,
    photoDraft = false,
    photoMatched = false,
    photoReadAs,
    insertShiftX,
    showHandles,
    showAnchors,
    onBeginDrag,
    isEditing,
  }: BoxedElementViewProps,
  {
    shapeHit,
    variant,
    layer,
    layerAnim,
    shapeKind,
    cornerPx,
    dropSide,
    indicators,
    own,
    surface,
    voteHighlighted,
    rotation,
    isAnnotation,
    hovering,
  }: BoxedChromeLocals,
) {
  return (
    <>
      {shapeHit && element.type === 'shape' ? (
        <ShapeHitOutline
          element={element}
          borderPx={typeof variant.style.borderWidth === 'number' ? variant.style.borderWidth : 0}
        />
      ) : null}

      {/* The Shape set's ring / halo / trace / gradient layer (AnimationLayer): over the face. */}
      {layer && layerAnim ? (
        <AnimationLayer
          animation={layerAnim}
          width={element.width}
          height={element.height}
          radius={
            shapeKind === 'circle' || shapeKind === 'stadium'
              ? Math.min(element.width, element.height) / 2
              : cornerPx
          }
        />
      ) : null}

      {/* Live drop preview while dragging a palette icon over this shape:
          a brand ring + a translucent band on the side the icon will
          land. Cleared on drop / drag-leave. */}
      {dropSide ? <IconDropPreview side={dropSide} /> : null}

      {/* The burst (docs/specs/009-elements/reaction-pad.md), a sibling of the label stack rather than a
          child of it: the particles leave the pad's box on purpose, and the
          face above clips to its own rounded corners. */}
      {reactionBurst ? (
        <ReactionBurst
          reaction={reactionBurst.reaction}
          seed={reactionBurst.seed}
          width={element.width}
          height={element.height}
          onDone={() => onReactionBurstDone?.(element.id)}
        />
      ) : null}

      {/* The element's own lock only: a locked tab or layer shows its padlock once, on the tab or the layer
          (canvas-and-palette.md "Locking"). */}
      {element.locked === true ? <LockBadge /> : null}

      {remoteSelectors.length > 0 ? <RemoteSelectorsStrip selectors={remoteSelectors} /> : null}

      {/* The annotation marker IS the note affordance, so it suppresses
          the generic note badge (it would be redundant). */}
      {indicators.layout ? (
        <ElementIndicators
          element={element}
          cornerPx={indicators.cornerPx}
          fill={indicatorBacking(own.fill ?? defaultFillColor(element, surface))}
          selected={isSelected}
          items={indicators.items}
          placed={indicators.layout}
        />
      ) : null}

      {/* Layer-scoped vote (docs/specs/012-collaboration/vote-layer-scope.md): a soft brand ring marking what CAN
          take a dot. Paired with the dimming of everything else: the two
          together answer "where do I click" without the user having to
          work out which layer each element is on. Pointer-events-none so
          it never intercepts the cast. */}
      {voteHighlighted ? (
        <div
          className="pointer-events-none absolute -inset-0.5 ring-2 ring-brand-400/70"
          style={{ borderRadius: 'inherit' }}
          aria-hidden
        />
      ) : null}

      {/* Dot-vote tally pill + winner ring (docs/specs/012-collaboration/session-tools.md): see
          ElementVoteOverlay. */}
      <ElementVoteOverlay
        voteKey={element.id}
        name={elementHasText(element) ? (element.label ?? '') : 'this element'}
        vote={vote}
        selfId={selfId}
        voteMax={voteMax}
        votableInVote={votableInVote}
        hasText={vote?.onlyWithText ? elementHasText(element) : true}
        voteReviewActive={voteReviewActive}
        isVoteFocus={isVoteFocus}
        box={element}
        onRetractVote={onRetractVote}
        onCastVote={onCastVote}
      />

      {/* The photo import's marks (photo-badges.tsx). */}
      {photoDraft ? <PhotoDraftRing /> : null}
      {photoMatched ? <PhotoMatchedBadge readAs={photoReadAs} /> : null}

      {/* Selection chrome (resize / edge-grip handles), portalled into the
          grips layer above every element: see SelectionChromeLayer for the
          stacking rationale. */}
      <SelectionChromeLayer
        elementId={element.id}
        box={element}
        rotation={rotation}
        shiftX={insertShiftX}
        showHandles={showHandles}
        showAnchors={showAnchors}
        onBeginDrag={onBeginDrag}
      />

      {/* Hover preview: float this annotation's note above every element
          (docs/specs/009-elements/annotations.md). Suppressed while selected (the click/edit popover owns
          that surface then) and only when there's note text to show. */}
      {isAnnotation && hovering && !isSelected && !isEditing && element.note ? (
        <AnnotationHoverNote
          elementId={element.id}
          note={element.note}
          noteRich={element.noteRich}
        />
      ) : null}
    </>
  );
}
