'use client';

import type { ReactNode } from 'react';
import { HintSurface } from './hint/HintSurface';
import { useHint } from './hint/useHint';

export type PreviewHintProps = {
  // What the trigger opens, as a picture: rendered only while the preview is open.
  preview: ReactNode;
  // Merged onto the wrapper after its display class, for a trigger that takes
  // part in its parent's layout.
  className?: string;
  children: ReactNode;
};

// A preview: a picture of what a control opens, shown after a resting hover
// and at once on keyboard focus (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md#preview).
// Not interactive. The preview content is the caller's, so a picture can be
// prepared (fetched, cached) before the hint ever opens.
export function PreviewHint({ preview, className, children }: PreviewHintProps) {
  const { open, attach, anchor, triggerProps, surfaceProps } = useHint('preview');
  return (
    <>
      <span
        ref={attach}
        {...triggerProps}
        className={`inline-flex min-w-0${className ? ` ${className}` : ''}`}
      >
        {children}
      </span>
      {open ? (
        <HintSurface kind="preview" anchor={anchor} surfaceProps={surfaceProps}>
          {preview}
        </HintSurface>
      ) : null}
    </>
  );
}
