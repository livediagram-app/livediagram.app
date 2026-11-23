'use client';

// A compact dropdown for the rich-text toolbars, kept INLINE (not portalled)
// so it stays inside the toolbar wrapper, where the editor's focus +
// canvas-propagation guards already apply. Closes on an option click (the
// menu's bubble handler) or an outside pointerdown (capture phase, so it fires
// before the wrapper stops propagation). The trigger preventDefaults mousedown
// so the editor keeps its selection while the menu is open.
//
// Shared by the label toolbar (RichTextToolbar) and the note toolbar
// (NoteFormatToolbar) — they host the same block-type picker (docs/specs/009-elements/block-type-picker.md) and a
// second copy of this would drift on the first behaviour fix.

import { useButtonLabels } from '@/components/canvas/SelectionPopoverButton';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDownIcon, HoverCard, Portal, useClickOutside } from '@livediagram/ui';
import { TOOLBAR_CONTROL_REST } from '@/components/chrome/toolbar-surface';

// preventDefault on mousedown keeps focus + the live selection in the
// contentEditable when a control is clicked (the classic rich-text-toolbar
// bug).
export const noFocusSteal = (e: React.MouseEvent) => e.preventDefault();

const CHEVRON = <ChevronDownIcon size={12} />;

// Where the open menu hangs: under its own trigger ('self'), or under the nearest positioned toolbar card with the
// trigger's left edge ('toolbar'), for a dropdown inside a strip that scrolls sideways, whose clip would cut the menu
// off. The menu keeps its static left there, which ignores the strip's scroll, so it is pulled back by that scroll
// on opening, and closes if the strip scrolls while it is open. 'portal': under its trigger but drawn on the page
// itself, for a dropdown inside a surface that clips (the element menu, whose bar holds a cardinality list wider
// than the menu): nothing cuts it off, it is kept on screen, and it closes on a scroll or a resize.
export type ToolbarDropdownMenuAnchor = 'self' | 'toolbar' | 'portal';

const EDGE = 8;

export function ToolbarDropdown({
  label,
  description,
  trigger,
  menuClassName = 'min-w-[8rem]',
  hideChevron = false,
  menuAnchor = 'self',
  children,
}: {
  label: string;
  description: string;
  trigger: React.ReactNode;
  menuClassName?: string;
  hideChevron?: boolean;
  menuAnchor?: ToolbarDropdownMenuAnchor;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // How far the strips between the trigger and the toolbar card are scrolled, read on opening.
  const [scrolled, setScrolled] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const portalled = menuAnchor === 'portal';
  useClickOutside(rootRef, () => setOpen(false), open && !portalled);
  // A portalled menu: where it stands (measured before paint, so it never flashes at the corner), and its own
  // outside press, which counts the menu as inside though it is not under the trigger in the page.
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !portalled) return;
    const trigger = rootRef.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (!trigger || !menu) return;
    const below = trigger.bottom + 4;
    setAt({
      left: Math.round(
        Math.max(EDGE, Math.min(trigger.left, window.innerWidth - menu.width - EDGE)),
      ),
      // Under the trigger; above it when there is no room below.
      top: Math.round(
        below + menu.height + EDGE <= window.innerHeight
          ? below
          : Math.max(EDGE, trigger.top - 4 - menu.height),
      ),
    });
  }, [open, portalled]);
  useEffect(() => {
    if (!open || !portalled) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('scroll', close, { capture: true, passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('scroll', close, { capture: true });
      window.removeEventListener('resize', close);
    };
  }, [open, portalled]);
  const toggle = () => {
    const root = rootRef.current;
    if (!open && menuAnchor === 'toolbar' && root) {
      let x = 0;
      for (let n = root.parentElement; n && n !== root.offsetParent; n = n.parentElement)
        x += n.scrollLeft;
      setScrolled(x);
    }
    // A portalled menu is placed afresh each time it opens.
    setAt(null);
    setOpen((o) => !o);
  };
  useEffect(() => {
    if (!open || menuAnchor !== 'toolbar') return;
    const close = (e: Event) => {
      if (e.target instanceof Node && e.target.contains(rootRef.current)) setOpen(false);
    };
    document.addEventListener('scroll', close, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', close, { capture: true });
  }, [open, menuAnchor]);
  const labelled = useButtonLabels();
  return (
    <div className={menuAnchor === 'self' ? 'relative' : undefined} ref={rootRef}>
      <HoverCard title={label} description={description}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          onMouseDown={noFocusSteal}
          onClick={toggle}
          className={`flex h-8 items-center gap-0.5 rounded-md px-1.5 transition ${
            open
              ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
              : TOOLBAR_CONTROL_REST
          }`}
        >
          {trigger}
          {labelled ? <span className="pl-1 text-xs font-medium">{label}</span> : null}
          {hideChevron ? null : CHEVRON}
        </button>
      </HoverCard>
      {open && portalled ? (
        <Portal>
          <div
            ref={menuRef}
            role="listbox"
            // The element menu counts a press here as inside it (its flyout marker), and the canvas never sees it.
            data-menu-flyout=""
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setOpen(false)}
            style={{
              left: at?.left ?? 0,
              top: at?.top ?? 0,
              visibility: at ? 'visible' : 'hidden',
            }}
            className={`fixed z-[var(--z-popover)] rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 ${menuClassName}`}
          >
            {children}
          </div>
        </Portal>
      ) : open ? (
        <div
          role="listbox"
          // An option click bubbles here and closes the menu after its own
          // handler runs.
          onClick={() => setOpen(false)}
          style={menuAnchor === 'toolbar' ? { marginLeft: -scrolled } : undefined}
          className={`absolute ${menuAnchor === 'self' ? 'left-0' : ''} top-full z-[var(--z-panel)] mt-1 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${menuClassName}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
