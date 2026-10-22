import type { ComponentProps } from 'react';
import type { BoxedElementView } from './BoxedElementView';

type BoxedProps = ComponentProps<typeof BoxedElementView>;

// What every boxed element view on the canvas takes from its layer, the same for each element.
export type BoxedShared = Omit<
  BoxedProps,
  | 'element'
  | 'isSelected'
  | 'isMultiSelected'
  | 'showHandles'
  | 'showAnchors'
  | 'isoDepth'
  | 'votableInVote'
  | 'layerOpacity'
  | 'remoteSelectors'
  | 'isEditing'
  | 'editCursorAtEnd'
  | 'movable'
  | 'writable'
  | 'resizable'
  | 'isVoteFocus'
  | 'commentActions'
  | 'actionActions'
  | 'revealedForMe'
  | 'reactionBurst'
  | 'fontFamily'
>;
