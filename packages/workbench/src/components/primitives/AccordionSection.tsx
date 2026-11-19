// A single-open accordion section: an uppercase header with the shared
// disclosure ChevronIcon, and a body that eases open on a grid-rows
// transition (which animates from nothing to the content's natural height
// without measuring it).
//
// Extracted on the third copy: the Settings dialog, the Shortcuts dialog, and
// the Avatar Panel all had the same header-button + grid-rows body markup, and
// ChevronIcon's own comment already called this out as the shape any future
// single-open accordion would want. `open` / `onToggle` stay CONTROLLED by the
// host so it can enforce "only one at a time" (or, for the Avatar Panel, "all
// closed to start"); the class hooks keep each host's own padding + tone.

import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ChevronIcon } from './ChevronIcon';

export function AccordionSection({
  title,
  open,
  onToggle,
  trailing,
  headerClassName = 'flex w-full items-center justify-between py-2 text-left',
  titleClassName = 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
  chevronClassName,
  bodyClassName = 'flex flex-col gap-2 pb-2',
  motionClassName = 'duration-short ease-out',
  headerProps,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  // Optional content between the title and the chevron — e.g. the current
  // value, so a collapsed section still says what it is set to.
  trailing?: ReactNode;
  headerClassName?: string;
  titleClassName?: string;
  chevronClassName?: string;
  bodyClassName?: string;
  // The body's open and close easing (its duration and curve).
  motionClassName?: string;
  // More for the header button (a data hook a host's arrow keys walk by); never its own type, click, expanded
  // state, controls or class.
  headerProps?: Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'type' | 'onClick' | 'aria-expanded' | 'aria-controls' | 'className'
  > & { [data: `data-${string}`]: string | boolean | undefined };
  children: ReactNode;
}) {
  // The header names the body it shows and hides (aria-controls), so a screen reader can jump to it.
  const bodyId = useId();
  return (
    <div>
      <button
        type="button"
        {...headerProps}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={headerClassName}
      >
        <span className={titleClassName}>{title}</span>
        <span className="flex items-center gap-1.5">
          {trailing}
          <ChevronIcon open={open} className={chevronClassName} />
        </span>
      </button>
      <div
        id={bodyId}
        // Collapsed, the body has no height but its controls are still there: inert keeps them out of the focus
        // order (Tab no longer lands on a hidden switch), aria-hidden out of the accessibility tree.
        inert={!open}
        aria-hidden={!open || undefined}
        className={`grid transition-[grid-template-rows] ${motionClassName} ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className={bodyClassName}>{children}</div>
        </div>
      </div>
    </div>
  );
}
