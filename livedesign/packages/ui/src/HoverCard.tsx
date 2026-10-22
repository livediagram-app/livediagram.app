'use client';

import type { CSSProperties, ReactNode } from 'react';
import { HintSurface } from './hint/HintSurface';
import { useHint } from './hint/useHint';

export type HoverCardProps = {
  // Bold first line: names the control.
  title: ReactNode;
  // What the control does, why it is disabled, what a badge means.
  description?: string;
  // Render the wrapper as a full-width flex container, so a control in a
  // grid cell or flex parent can still stretch. Default `inline-flex` keeps
  // toolbar controls from reflowing.
  block?: boolean;
  // Merged onto the wrapper after its display class, for a trigger that has
  // to take part in its parent's layout (a flex child, a bar sized by %).
  className?: string;
  style?: CSSProperties;
  // Keeps the card from showing (while the control's own popover is open, which the card would sit over). The
  // wrapper stays, so the control is never re-parented: unwrapping it remounted the button and dropped its focus.
  disabled?: boolean;
  children: ReactNode;
};

// A hover card: a bold title over a short description, shown at once on
// hover and on keyboard focus (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md).
// Use it where a control needs explaining; use Tooltip where only its name
// is worth saying.
export function HoverCard({
  title,
  description,
  block = false,
  className,
  style,
  disabled = false,
  children,
}: HoverCardProps) {
  const { open, attach, anchor, triggerProps, surfaceProps } = useHint('hover-card');
  return (
    <>
      <span
        ref={attach}
        {...triggerProps}
        className={`${block ? 'flex w-full' : 'inline-flex'}${className ? ` ${className}` : ''}`}
        style={style}
      >
        {children}
      </span>
      {open && !disabled ? (
        <HintSurface kind="hover-card" anchor={anchor} surfaceProps={surfaceProps}>
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {description}
            </p>
          ) : null}
        </HintSurface>
      ) : null}
    </>
  );
}
