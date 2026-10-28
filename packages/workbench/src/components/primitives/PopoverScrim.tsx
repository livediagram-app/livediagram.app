'use client';

// The button a shown dock popover hangs from (useDockPopoverKeys' OPEN_TRIGGER).
const OPEN_TRIGGER =
  '[data-dock-button][aria-expanded="true"], [data-dock-button] [aria-expanded="true"]';

/**
 * The dimmed scrim behind a popover that wants the person's focus (the editors' Explorer panel,
 * liveworkspace/docs/specs/004-index/one-explorer.md "The editors' Explorer panel"): a translucent slate over the
 * whole window, fading in where motion is allowed. Rendered just before its popover in the same stacking layer, so
 * it covers the canvas and the editor's chrome while the popover, and the menus and dialogs it opens (portalled
 * above), stay over it. A press on it closes the popover, as a press outside always did, and hands focus back to the
 * popover's button; it never takes the press itself, so nothing under it reacts.
 */
export function PopoverScrim({ onClose }: { onClose?: () => void }) {
  // The press ends on the scrim, so nothing under it (the canvas) sees any of it; it closes on the click.
  const close = () => {
    const trigger = document.querySelector<HTMLElement>(OPEN_TRIGGER);
    onClose?.();
    // Once the popover has gone (its button re-rendered closed).
    requestAnimationFrame(() => trigger?.focus({ preventScroll: true }));
  };
  return (
    <div
      aria-hidden
      data-popover-scrim=""
      // Kept from the popover's outside-press check (a document listener): the click closes it, once.
      onPointerDown={(e) => e.stopPropagation()}
      // Pressing would move focus to the page: it goes back to the popover's button instead.
      onMouseDown={(e) => e.preventDefault()}
      onClick={close}
      onContextMenu={(e) => e.preventDefault()}
      className="pointer-events-auto fixed inset-0 z-[var(--z-toolbar)] cursor-default bg-slate-900/25 motion-safe:animate-fade-in dark:bg-slate-950/55"
    />
  );
}
