'use client';

import type { ReactNode } from 'react';
import { HintSurface } from './hint/HintSurface';
import { useHint, type HintTriggerProps } from './hint/useHint';

export type RowPreview = {
  // Callback ref for the row: the pointer side of the trigger. The preview is placed against the
  // row's first cell, the one that names what the row opens.
  rowRef: (el: HTMLElement | null) => void;
  // Spread on the row: a resting hover anywhere on it opens the preview, a press anywhere closes it.
  rowProps: Omit<HintTriggerProps, 'onFocus' | 'onBlur'>;
  // Spread on the row's main control (its name link): only its keyboard focus opens the preview at
  // once. Focus elsewhere in the row (its menu button) bubbles to the row, and must not.
  focusProps: Pick<HintTriggerProps, 'onFocus' | 'onBlur'>;
  // The preview while it is open, else null: render it anywhere in the row (it portals to <body>).
  surface: ReactNode;
};

// A preview for a whole row: a picture of what the row opens, shown after a resting hover on the row
// and at once on keyboard focus of its name
// (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md#preview). Not interactive. The
// preview content is the caller's, so a picture can be prepared (fetched, cached) before it opens.
export function useRowPreview(preview: ReactNode): RowPreview {
  const { open, attach, anchor, triggerProps, surfaceProps } = useHint('preview');
  const { onFocus, onBlur, ...rowProps } = triggerProps;
  return {
    rowRef: attach,
    rowProps,
    focusProps: { onFocus, onBlur },
    surface: open ? (
      <HintSurface kind="preview" anchor={anchor} surfaceProps={surfaceProps}>
        {preview}
      </HintSurface>
    ) : null,
  };
}
