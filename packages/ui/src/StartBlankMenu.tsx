'use client';

// The site header's Start Blank (docs/specs/019-marketing/marketing-site.md "The Start Blank
// menu"): a menu button offering one blank per editor mode, each straight into the editor with no
// wizard (docs/specs/007-editor/new-document-route.md "Start Blank"). The rows wear the editor's
// mode-switch glyphs, so the choice looks the same here as it does in the app.
//
// Opens like the apps menu beside the logo (ProductNav): mouse hover shows it through CSS without
// taking focus, and a press or the keyboard opens it with focus inside (useMenuButton + useMenu).

import { ctaHref, type CtaSlot, type CtaSource, type CtaSurface } from '@livediagram/api-schema';
import { useRef, type ComponentType } from 'react';
import { ButtonContent, buttonClassName } from './Button';
import {
  ChevronDownIcon,
  FlowchartIcon,
  IllustrateIcon,
  PlanIcon,
  MarkerIcon,
  type IconProps,
} from './icons';
import { useMenu } from './menu/useMenu';
import { useMenuButton } from './menu/useMenuButton';
import { useClickOutside } from './useClickOutside';

type HeaderSurface = Exclude<CtaSurface, 'Help'>;

const BLANKS: {
  label: string;
  desc: string;
  href: string;
  slot: CtaSlot<HeaderSurface>;
  Icon: ComponentType<IconProps>;
}[] = [
  {
    label: 'Blank Diagram',
    desc: 'Shapes, connectors and structure',
    href: '/new?blank=1',
    slot: 'HeaderDraw',
    Icon: FlowchartIcon,
  },
  {
    label: 'Blank Whiteboard',
    desc: 'Free drawing without distractions',
    href: '/new?template=whiteboard',
    slot: 'HeaderWhiteboard',
    Icon: MarkerIcon,
  },
  {
    label: 'Blank Illustration',
    desc: 'Pages for infographics and articles',
    href: '/new?template=blank-illustration',
    slot: 'HeaderIllustration',
    Icon: IllustrateIcon,
  },
  {
    label: 'Blank Plan',
    desc: 'A board of cards to move through columns',
    href: '/new?template=blank-plan',
    slot: 'HeaderPlan',
    Icon: PlanIcon,
  },
];

// `className` is the header's placement only (it hides the menu below `sm`).
export function StartBlankMenu({
  ctaSurface,
  className = '',
}: {
  ctaSurface?: HeaderSurface;
  className?: string;
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
        className={buttonClassName({
          variant: 'secondary',
          size: 'md',
          className: 'cursor-pointer shadow-sm',
        })}
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
      <div
        className={`absolute right-0 top-full z-50 pt-2 transition-all duration-micro group-hover:visible group-hover:opacity-100 motion-reduce:transition-none ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div
          ref={attach}
          {...surfaceProps}
          className="w-max rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 outline-none dark:border-slate-700 dark:bg-slate-800 dark:shadow-black/30"
        >
          {BLANKS.map(({ label, desc, href, slot, Icon }) => (
            <a
              key={slot}
              href={ctaSurface ? ctaHref(href, `${ctaSurface}.${slot}` as CtaSource) : href}
              role="menuitem"
              tabIndex={-1}
              onClick={close}
              className="group/blank flex items-start gap-2.5 rounded-lg px-3 py-2 transition hover:bg-slate-100 focus-visible:bg-slate-100 dark:hover:bg-slate-700 dark:focus-visible:bg-slate-700"
            >
              <span className="mt-0.5 shrink-0 text-slate-500 group-hover/blank:text-brand-600 dark:text-slate-400 dark:group-hover/blank:text-brand-300">
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
