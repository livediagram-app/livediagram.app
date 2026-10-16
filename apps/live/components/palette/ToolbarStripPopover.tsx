'use client';

import { useEffect, useEffectEvent, useRef, useState, type ReactNode, type RefObject } from 'react';
import { uiUnscaleStyle } from '@/lib/ui-scale';

// A popover hanging under the Toolbar layout's strip (docs/specs/007-editor/toolbar-layout.md): More
// and Search. Both are strip menus, so they share how they open, where they hang and how they close.

// Clicks inside these don't count as "outside" a strip popover: the icon
// filter's portalled dropdown menus, and any dialog a category body opens
// (closing the popover would unmount it mid-edit).
// The popover's width on a desktop (the card's w-[26rem]), at design size.
const STRIP_POPOVER_PX = 416;

const INSIDE_SELECTOR = '[data-palette-dropdown-menu], [role="dialog"], [data-tour-popover]';

/** One strip popover's open state and where it hangs. `ownSelector` matches the popover and its
 *  button: a press anywhere else (the pickers, a tile, another strip button, the canvas) closes it,
 *  so two strip menus are never open at once, and so does Escape. */
export function useStripPopover(rootRef: RefObject<HTMLElement | null>, ownSelector: string) {
  const [open, setOpen] = useState(false);
  // Its right edge under the button's right edge, as an offset into the strip's row. Measured on
  // the click that opens it; the strip is centred, so a window resize moves both together and the
  // offset stays right.
  const [right, setRight] = useState(0);
  const close = useEffectEvent(() => setOpen(false));
  // While open, the trays hanging from the strip step aside (PaletteTray), as they do for the Explorer: they would
  // cover the popover's top.
  useEffect(() => {
    if (!open) return;
    document.body.setAttribute('data-strip-popover-open', '');
    return () => document.body.removeAttribute('data-strip-popover-open');
  }, [open]);
  useEffect(() => {
    if (!open) return;
    // Capture phase: the strip stops pointerdown from reaching the canvas.
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest(ownSelector) || t.closest(INSIDE_SELECTOR)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, ownSelector]);
  // `centre` hangs it centred under the button (a strip group's popover) rather than from its right edge, kept
  // inside the row. `width` is the card's design width, for a popover wider or narrower than the usual 26rem.
  const openFrom = (
    button: HTMLElement,
    align: 'right' | 'centre' = 'right',
    width: number = STRIP_POPOVER_PX,
  ) => {
    const root = rootRef.current?.getBoundingClientRect();
    const box = button.getBoundingClientRect();
    if (root)
      setRight(
        align === 'centre'
          ? Math.min(
              Math.max(0, root.right - (box.left + box.width / 2) - width / 2),
              Math.max(0, root.width - width),
            )
          : root.right - box.right,
      );
    setOpen(true);
  };
  return { open, right, openFrom, setOpen };
}

/** The popover's card. Hangs from its button, not the middle of the strip; wide rather than tall,
 *  so a body rarely has to scroll, and capped to the window so a long one scrolls rather than
 *  running off it. A phone has no room to hang it from the button: it spans the screen between the
 *  side gutters instead. Opening it focuses its first text field, so typing filters straight away
 *  (a body that loads its catalogue lazily mounts the field a beat later, so it watches for it);
 *  not on a phone, where focusing would raise the keyboard over it. */
export function StripPopover({
  right,
  isMobile,
  scale,
  label,
  dataAttr,
  widthClass = 'w-[26rem]',
  glide = false,
  bare = false,
  seeThrough = false,
  children,
}: {
  right: number;
  isMobile: boolean;
  scale: number;
  // The small heading over the body; absent for a body that names itself.
  label?: ReactNode;
  // Marks the card for its popover's ownSelector.
  dataAttr: string;
  // Its width on a desktop.
  widthClass?: string;
  // Moving to another button slides it there rather than jumping (the category bar's flyout).
  glide?: boolean;
  // No padding: the body lays out its own edges.
  bare?: boolean;
  // A tile is being dragged out of it: faded, and a drop on it lands on the canvas beneath (`data-drop-through`,
  // which the canvas's drop guard reads, lib/canvas-pointer `overFloatingPanel`). Not `pointer-events: none`: the
  // dragged tile is inside it, and taking hit-testing from a drag's own source stalls the drag.
  seeThrough?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const popover = ref.current;
    if (isMobile || !popover) return;
    const focusSearch = () => {
      const field = popover.querySelector<HTMLInputElement>(
        'input[type="search"], input[type="text"], input:not([type])',
      );
      if (!field) return false;
      field.focus();
      return true;
    };
    if (focusSearch()) return;
    const observer = new MutationObserver(() => {
      if (focusSearch()) observer.disconnect();
    });
    observer.observe(popover, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isMobile]);
  return (
    <div
      ref={ref}
      {...{ [dataAttr]: '' }}
      {...(seeThrough ? { 'data-drop-through': '' } : {})}
      // Chrome, not canvas, like the strip it hangs from.
      data-floating-panel=""
      // A menu, so it stays at design size while the strip is scaled
      // (docs/specs/007-editor/ui-scale.md): the counter-zoom brings it back to 1, so `right`
      // (screen px) and the classes' width and height cap apply as written.
      style={isMobile ? undefined : { ...uiUnscaleStyle(scale), right }}
      className={`absolute top-full mt-2 max-h-[calc(100dvh-14rem)] ${isMobile ? 'inset-x-3' : widthClass} ${glide ? 'transition-[right,width,opacity] duration-short ease-out' : ''} ${seeThrough ? 'opacity-30' : ''} origin-top-right animate-dropdown-down overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white ${bare ? '' : 'px-2 py-2.5'} shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40`}
    >
      {label ? (
        <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}
