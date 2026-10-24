// A single-open accordion section: an uppercase header with the shared
// disclosure ChevronIcon, and a body that eases open on a grid-rows
// transition (which animates from nothing to the content's natural height
// without measuring it).
//
// Settings' copy of the editors' AccordionSection (a collapsed section, the shortcut list's groups).
// `open` / `onToggle` stay CONTROLLED by the host so it can enforce "only one at a time"; the class
// hooks keep each host's own padding and tone.

import type { ReactNode } from 'react';
import { ChevronIcon } from './glyphs';

export function AccordionSection({
  title,
  open,
  onToggle,
  trailing,
  headerClassName = 'flex w-full items-center justify-between py-2 text-left',
  titleClassName = 'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
  chevronClassName,
  bodyClassName = 'flex flex-col gap-2 pb-2',
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
  children: ReactNode;
}) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className={headerClassName}>
        <span className={titleClassName}>{title}</span>
        <span className="flex items-center gap-1.5">
          {trailing}
          <ChevronIcon open={open} className={chevronClassName} />
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-short ease-out ${
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
