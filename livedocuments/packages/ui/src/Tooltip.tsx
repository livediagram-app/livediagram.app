'use client';

import { useEffect, type ReactElement } from 'react';
import { HintSurface } from './hint/HintSurface';
import { accessibleNameOf, nameSaysLabel } from './hint/trigger-text';
import { useHint } from './hint/useHint';

export type TooltipProps = {
  // The control's name: the same words as its aria-label or visible text.
  label: string;
  children: ReactElement;
};

// A tooltip: the control's name, after a 500 ms hover or at once on keyboard
// focus (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md). Never the only carrier of
// the name; the control keeps its own accessible name and this repeats it.
//
// The wrapper is `display: contents`, so the control keeps its place in any
// grid or flex layout and callers need no layout props.
export function Tooltip({ label, children }: TooltipProps) {
  const { open, attach, anchor, triggerProps, surfaceProps } = useHint('tooltip');

  useEffect(() => {
    if (!open) return;
    const target = anchor();
    if (!target) return;
    const name = accessibleNameOf(target);
    if (!nameSaysLabel(name, label)) {
      console.warn('[tooltip] label is not the accessible name', { label, name });
    }
  }, [open, anchor, label]);

  if (!label) return children;
  return (
    <>
      <span ref={attach} {...triggerProps} className="contents">
        {children}
      </span>
      {open ? (
        <HintSurface kind="tooltip" anchor={anchor} surfaceProps={surfaceProps}>
          {label}
        </HintSurface>
      ) : null}
    </>
  );
}
