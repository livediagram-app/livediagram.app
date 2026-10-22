'use client';

// A chart its Sheet draws (docs/specs/029-sheets/sheet.md "Charts"), drawn by the canvas's own element view: the
// same BoxedElementView, with the same handlers the canvas gives every element, so its palette, fill, border,
// corners, shadow, opacity, animations, legend and indicators (comments, actions, notes, links) are exactly the
// canvas's, and every popover that finds an element by its `data-element-id` finds it in the Sheet. The Sheet's own
// frame around it moves, resizes and selects it; this view takes no pointer itself (its indicators still do).
import { useCallback, type ComponentProps, type ReactNode } from 'react';
import { resolveFontStack, type ShapeElement } from '@livepages/document';
import { BoxedElementView } from './BoxedElementView';
import { ElementIndicatorStyleProvider } from './ElementIndicatorStyleContext';

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

// Draws `element` as the canvas would, at its frame's origin. `interactive` false for a chart of another tab (a
// Dashboard slot showing a Sheet): drawn the same, its indicators off, since their threads are on that tab.
export type SheetChartRenderer = (element: ShapeElement, interactive: boolean) => ReactNode;

const NO_REMOTE: BoxedProps['remoteSelectors'] = [];

// At the frame's origin, and never turned: a chart sits square on the grid's cells (sheet.md "Charts").
export function sheetChartElement(element: ShapeElement): ShapeElement {
  const { rotation: _rotation, ...rest } = element;
  return { ...rest, x: 0, y: 0 };
}

export function useSheetChartRenderer(
  shared: BoxedShared,
  tabFontStack: string | undefined,
): SheetChartRenderer {
  return useCallback(
    (element, interactive) => {
      const view = (
        <BoxedElementView
          {...shared}
          element={sheetChartElement(element)}
          isSelected={false}
          isMultiSelected={false}
          showHandles={false}
          showAnchors={false}
          isoDepth={0}
          remoteSelectors={NO_REMOTE}
          isEditing={false}
          // The Sheet's frame moves and resizes it; nothing types on a chart.
          movable={false}
          writable={false}
          resizable={false}
          readOnly={shared.readOnly || !interactive}
          fontFamily={resolveFontStack(element.font) ?? tabFontStack}
        />
      );
      return interactive ? (
        view
      ) : (
        <ElementIndicatorStyleProvider style="off">{view}</ElementIndicatorStyleProvider>
      );
    },
    [shared, tabFontStack],
  );
}
