'use client';

// The site header's Start Blank (docs/specs/019-marketing/marketing-site.md "The Start Blank
// menu"), also in the landing hero's search bar: a menu button offering one blank per editor mode, each straight into the editor with no
// wizard (docs/specs/007-editor/new-document-route.md "Start Blank"). The rows wear the editor's
// mode-switch glyphs, so the choice looks the same here as it does in the app.
//
// Opens like the apps menu beside the logo (ProductNav): mouse hover shows it through CSS without
// taking focus, and a press or the keyboard opens it with focus inside (useMenuButton + useMenu).

import { ctaHref, isCtaSource, type CtaSlot, type CtaSurface } from '@livediagram/api-schema';
import { cascadeDelayMs } from '@livediagram/tailwind-config/motion';
import { useRef } from 'react';
import { ButtonContent, buttonClassName } from './Button';
import { ChevronDownIcon } from './icons';
import { START_BLANKS } from './start-blanks';
import { useMenu } from './menu/useMenu';
import { useMenuButton } from './menu/useMenuButton';
import { useClickOutside } from './useClickOutside';

type HeaderSurface = CtaSurface;

// Where the menu sits, which names its funnel slots: the header's `Header<Blank>`, or the landing
// hero's `HeroBlank<Blank>`, so the funnel tells the two apart.
type StartBlankPlace = 'Header' | 'HeroBlank';

// A blank's link, tagged with its funnel source when the surface lists that slot (docs/specs/019-marketing/
// landing-funnel.md). Checked against the table rather than cast, so a surface missing a slot sends a plain
// link instead of a source the editor would drop.
export function blankHref(
  href: string,
  slot: CtaSlot<HeaderSurface> | `HeroBlank${string}`,
  surface?: HeaderSurface,
): string {
  const source = surface ? `${surface}.${slot}` : null;
  return isCtaSource(source) ? ctaHref(href, source) : href;
}

// `className` is the placement only (the header hides the menu below `sm`). `triggerClassName`
// replaces the button's own look where the menu sits on a surface of its own (the hero's search bar).
export function StartBlankMenu({
  ctaSurface,
  className = '',
  place = 'Header',
  triggerClassName,
}: {
  ctaSurface?: HeaderSurface;
  className?: string;
  place?: StartBlankPlace;
  triggerClassName?: string;
}) {
  const { open, close, toggle, trigger, setTrigger, initialFocus, onTriggerKeyDown } =
    useMenuButton();
  const ref = useRef<HTMLDivElement>(null);
  const { attach, surfaceProps } = useMenu({
    open,
    onClose: close,
    trigger,
    initialFocus,
    label: 'Start Blank',
  });
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className={`group relative shrink-0 ${className}`}>
      <button
        ref={setTrigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        className={
          triggerClassName ??
          buttonClassName({
            variant: 'secondary',
            size: 'md',
            className: 'cursor-pointer shadow-sm',
          })
        }
      >
        <ButtonContent>Start Blank</ButtonContent>
        <ChevronDownIcon
          size={12}
          aria-hidden
          className={`h-3 w-3 opacity-60 transition-transform duration-micro group-hover:[transform:rotate(180deg)] motion-reduce:transition-none ${
            open ? '[transform:rotate(180deg)]' : ''
          }`}
        />
      </button>

      {/* pt-2 is a transparent bridge so the pointer can travel from the button to the card
          without crossing a gap that would close it. Dropped from the right edge so it never runs
          past the primary beside it. */}
      {/* Shown by display (hover, or open), so its rows fan down afresh on every open. */}
      <div
        className={`absolute right-0 top-full z-50 pt-2 group-hover:block ${open ? 'block' : 'hidden'}`}
      >
        <div
          ref={attach}
          {...surfaceProps}
          className="w-max rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 outline-none dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30"
        >
          {START_BLANKS.map(({ label, desc, href, blank, Icon }, i) => (
            <a
              key={blank}
              href={blankHref(href, `${place}${blank}`, ctaSurface)}
              role="menuitem"
              tabIndex={-1}
              onClick={close}
              // Each row drops into place a beat after the one above (menu-fan-row, the shared cascade).
              style={{ animationDelay: `${cascadeDelayMs(i)}ms` }}
              className="menu-fan-row group/blank flex items-start gap-2.5 rounded-lg px-3 py-2 transition hover:bg-slate-100 focus-visible:bg-slate-100 dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"
            >
              <span className="mt-0.5 shrink-0 text-slate-500 group-hover/blank:text-brand-700 dark:text-slate-400 dark:group-hover/blank:text-brand-300">
                <Icon size={16} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 dark:group-hover/blank:text-white">
                  {label}
                </span>
                <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                  {desc}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
