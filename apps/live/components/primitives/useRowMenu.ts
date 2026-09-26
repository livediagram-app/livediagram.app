import { useCallback, useRef, useState, type MouseEvent } from 'react';

// The open / closed state of a row's (or card's) ⋯ actions menu, and the
// two ways in: the ellipsis trigger toggles it, a right-click anywhere on
// the row opens it anchored to that same trigger.
//
// Eight Explorer rows and cards wrote this out longhand (a useState, a
// button ref, an onContextMenu that preventDefaults, a stopPropagation
// toggle). They agreed on the shape but not on the details: some passed
// aria-expanded and some didn't, one had no right-click at all. The hook
// is that shape once.
//
// `disabled` switches the right-click off (a row mid-rename lets the
// browser's own menu through, so the input's cut / paste still work).
// Spread `triggerProps` onto EllipsisTriggerButton; `onContextMenu` goes
// on the row's root element.
export function useRowMenu({ disabled = false }: { disabled?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const onTriggerClick = useCallback((e: MouseEvent) => {
    // The trigger sits inside a clickable row; the row must not open too.
    e.stopPropagation();
    setOpen((o) => !o);
  }, []);
  const onContextMenu = disabled
    ? undefined
    : (e: MouseEvent) => {
        e.preventDefault();
        setOpen(true);
      };
  return {
    open,
    close,
    triggerRef,
    onContextMenu,
    triggerProps: { ref: triggerRef, onClick: onTriggerClick, expanded: open },
  };
}
