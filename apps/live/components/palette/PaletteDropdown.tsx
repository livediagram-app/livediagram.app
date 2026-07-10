import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Portal } from '@/components/primitives/Portal';
import { Tooltip } from '@/components/primitives/Tooltip';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';

export type PaletteDropdownOption = {
  id: string;
  label: string;
  // Optional leading glyph shown both in the trigger (when this option is
  // selected) and beside the option in the menu. Any size of <svg> is
  // normalised to 14px by the wrapper so mixed icon sets line up.
  icon?: React.ReactNode;
  // Optional single-key shortcut letter rendered as a subtle badge in the
  // menu row (the canvas-tool dropdown uses S / P / L).
  shortcut?: string;
  // When true the option is shown greyed out and can't be picked (e.g. canvas
  // tools that need existing content, disabled on an empty canvas).
  disabled?: boolean;
  // Optional group index for visual separation: a divider is drawn in the
  // menu wherever the group changes between two visible (non-selected)
  // options. Robust to the selected option being filtered out — dividers
  // only ever fall between groups that both still have visible items, never
  // leading / trailing / doubled. Options without a group never divide.
  group?: number;
};

// Normalises whatever <svg> an option carries to a consistent 14px box so
// the 13px tool glyphs and the 18px category glyphs render at one size.
const ICON_WRAP =
  'flex h-[14px] w-[14px] shrink-0 items-center justify-center [&>svg]:h-[14px] [&>svg]:w-[14px]';

// A compact select-style dropdown for the palette: a bordered trigger that
// shows the current option (icon + label + chevron) and a listbox popover
// to switch. Replaces the bespoke inline dropdown that the icon-category
// filter used to carry, and now also drives the canvas-tool and palette-
// category pickers, so all three share one keyboard / outside-click / a11y
// implementation instead of three copies.
//
// The menu is portalled to <body> and positioned with `position: fixed`
// against the trigger's rect: the palette body is an `overflow-y-auto`
// box with a viewport-capped max-height, so an in-flow `absolute` menu got
// clipped (or forced the panel to scroll) whenever the palette was short.
// Portalling escapes that clip and lets the menu flip above the trigger
// when there's no room below.
export function PaletteDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  tooltipTitle,
  tooltipDescription,
  align = 'left',
  accent = false,
  triggerLeading,
  menuClassName = 'w-max min-w-[7rem] max-w-[12rem]',
  variant = 'bordered',
  autoHeight = false,
}: {
  value: string;
  options: PaletteDropdownOption[];
  onChange: (id: string) => void;
  ariaLabel: string;
  // When set, the trigger gets a hover/focus tooltip (used by the icon
  // filter to explain what the funnel does).
  tooltipTitle?: string;
  tooltipDescription?: string;
  // Which edge the popover hangs from. Right-aligned dropdowns (the
  // right-hand category picker) keep the menu inside the panel.
  align?: 'left' | 'right';
  // Brand-tinted trigger for an "active filter" state (icon filter when a
  // specific category is picked).
  accent?: boolean;
  // Fixed glyph rendered before the label on the trigger, regardless of the
  // selected option (the icon filter's funnel).
  triggerLeading?: React.ReactNode;
  // Width (and any extra layout) for the popover menu. Defaults to hugging
  // its content so a list of short labels (Shapes / Tools / ...) doesn't
  // sit in a needlessly wide box.
  menuClassName?: string;
  // Trigger appearance. 'bordered' is the standalone pill (icon filter);
  // 'flush' drops the border + rounding so the control sits flush against
  // the top and sides of a header band (the canvas-tool / category row).
  variant?: 'bordered' | 'flush';
  // Drop the menu's max-height + scroll, so it grows to fit its options
  // instead of capping at ~56 and showing a scrollbar. For short, fixed
  // lists (the canvas-tool picker) where every option should always be
  // visible; leave off for long lists (icon categories) that need to scroll.
  autoHeight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Fixed-position coords for the portalled menu. `left`/`right` is picked
  // by `align`; `top` flips above the trigger when the menu would spill off
  // the bottom of the viewport.
  const [coords, setCoords] = useState<{
    left?: number;
    right?: number;
    top: number;
    width: number;
    flipUp: boolean;
  } | null>(null);
  // 'flush' pickers (the palette tool + category rows) read as one connected
  // control: the menu sits flush against the trigger (no gap) and matches its
  // width. Bordered filter pills keep a small gap and hug their content.
  const connected = variant === 'flush';
  const gap = connected ? 0 : 4;

  // Outside-click closes — but the menu lives in a portal, so a click in it
  // is NOT inside `triggerRef`; check the menu too or selecting an option
  // would close before its handler runs.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Position the menu while open, re-running on scroll / resize so it tracks
  // the trigger (the palette is a draggable panel). Measures the menu's own
  // height to decide whether to open downward or flip above.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trig = triggerRef.current?.getBoundingClientRect();
      if (!trig) return;
      const menuH = menuRef.current?.offsetHeight ?? 0;
      const below = trig.bottom + gap;
      const flipUp = below + menuH > window.innerHeight - EDGE && trig.top - gap - menuH > EDGE;
      const top = flipUp ? trig.top - gap - menuH : below;
      const base = { top, width: trig.width, flipUp };
      setCoords(
        align === 'right'
          ? { ...base, right: window.innerWidth - trig.right }
          : { ...base, left: trig.left },
      );
    };
    place();
    // Second pass once the menu has measured height (for the flip decision).
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align, gap]);

  // Click-only: the dropdown opens on click and closes on click / outside
  // pointer-down (see the effect above). No hover-open — hovering across a
  // dropdown must never change the open category underneath the pointer.
  const selected = options.find((o) => o.id === value) ?? options[0];
  // 'flush' triggers (the palette's tool + category pickers) get roomier
  // padding than the bordered filter dropdowns so they're a bigger, easier
  // hit target at the top of the panel.
  const shape =
    variant === 'flush' ? 'rounded-none border-0 px-3.5 py-3' : 'h-[26px] rounded-md border px-2';
  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={ariaLabel}
      className={`flex min-w-0 items-center gap-1.5 ${shape} ${variant === 'flush' ? 'text-xs' : 'text-[11px]'} font-medium transition ${
        accent
          ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-200'
          : variant === 'flush'
            ? // Flush triggers sit directly on the panel header, so they stay
              // transparent at rest — the bordered pill's bg-white/slate-800
              // fill read as a stray lighter box on the dark slate-900 panel.
              'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {triggerLeading}
      {selected?.icon ? <span className={ICON_WRAP}>{selected.icon}</span> : null}
      <span className="truncate">{selected?.label}</span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0"
      >
        <path d="M3 4.5 6 7.5 9 4.5" />
      </svg>
    </button>
  );
  return (
    <div className="relative min-w-0" ref={triggerRef}>
      {tooltipTitle ? (
        <Tooltip title={tooltipTitle} description={tooltipDescription ?? ''}>
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      {open ? (
        <Portal>
          <div
            ref={menuRef}
            role="listbox"
            data-palette-dropdown-menu
            className={`fixed z-[var(--z-overlay)] w-max border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${
              autoHeight ? '' : 'max-h-56 overflow-y-auto'
            } ${
              // Connected pickers drop the corner that meets the trigger so the
              // menu reads as one piece with it; bordered pills stay fully
              // rounded + hug their content via menuClassName.
              connected
                ? coords?.flipUp
                  ? 'rounded-t-md'
                  : 'rounded-b-md'
                : `rounded-md ${menuClassName}`
            }`}
            style={{
              left: coords?.left,
              right: coords?.right,
              top: coords?.top ?? -9999,
              // Use the trigger width as a FLOOR (so the menu reads as one
              // continuous column with it) but let it grow to fit the option
              // labels — clamping to the trigger width truncated names like
              // "Eraser" to "Er...".
              ...(connected && coords ? { minWidth: coords.width } : {}),
            }}
          >
            {/* The trigger already shows the current option, so the menu lists
                only the OTHER options to switch to (no duplicate of the
                selected one). */}
            {/* The trigger already shows the current option, so filter it out
                first, THEN decide dividers from the surviving list — a divider
                sits before an option whose group differs from the previous
                visible one (never at the top, so no stray leading rule). */}
            {options
              .filter((opt) => opt.id !== value)
              .map((opt, i, visible) => {
                const prev = visible[i - 1];
                const divide =
                  i > 0 && opt.group !== undefined && prev?.group !== undefined
                    ? opt.group !== prev.group
                    : false;
                return (
                  <div key={opt.id}>
                    {divide ? (
                      <div
                        role="separator"
                        className="mx-2 my-1 border-t border-slate-200 dark:border-slate-700"
                      />
                    ) : null}
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      disabled={opt.disabled}
                      onClick={() => {
                        if (opt.disabled) return;
                        onChange(opt.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 text-left text-slate-600 dark:text-slate-300 ${
                        opt.disabled
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      } ${
                        // Match the trigger's sizing so the options read as the
                        // same control AND are the same height as the selected
                        // item (`py-3`), which is an easier tap target on touch.
                        // Flush pickers are roomier than the compact filter pills.
                        connected ? 'px-3.5 py-3 text-xs' : 'px-2.5 py-1.5 text-[11px]'
                      }`}
                    >
                      {opt.icon ? <span className={ICON_WRAP}>{opt.icon}</span> : null}
                      <span className="flex-1 truncate">{opt.label}</span>
                      {opt.shortcut ? (
                        <kbd className="rounded-[3px] border border-slate-300 bg-white px-1 text-[8px] font-semibold uppercase leading-[1.4] text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
                          {opt.shortcut}
                        </kbd>
                      ) : null}
                    </button>
                  </div>
                );
              })}
          </div>
        </Portal>
      ) : null}
    </div>
  );
}
