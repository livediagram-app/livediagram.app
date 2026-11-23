'use client';

// A phone's footer has room for the three view tabs and little else (docs/specs/030-knowledgebase/page-surface.md
// "The footer"): the bar's other items (Get Started, Tools, Settings, the appearance) stand behind this one More
// button, in a card that opens above it. The items are the bar's own controls, drawn once, here.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Glyph, HoverCard, useClickOutside } from '@liveknowledge/ui';
import { CHROME_BTN } from '@liveworkspace/workbench/components/chrome/chrome-button';

export function FooterMore({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useClickOutside(wrap, () => setOpen(false), open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <div ref={wrap} className="relative flex shrink-0 items-center">
      <HoverCard title="More" description="Get Started, Tools, Settings and the appearance.">
        <button
          ref={button}
          type="button"
          aria-label="More"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          data-footer-more=""
          onClick={() => setOpen((was) => !was)}
          className={`${CHROME_BTN} cursor-pointer focus-visible:outline-2 focus-visible:outline-brand-600 ${
            open ? 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white' : ''
          }`}
        >
          <Glyph size={16} units={16}>
            <circle cx="3.5" cy="8" r="1" />
            <circle cx="8" cy="8" r="1" />
            <circle cx="12.5" cy="8" r="1" />
          </Glyph>
        </button>
      </HoverCard>
      {/* Kept mounted while closed, so a control inside (Tools' own menu, the tour's offer) keeps its state. At the
          popover layer, as a menu is: the Ask, Insights and Connect views (a canvas modal) stop at the footer, and
          the card rising above it was drawn under them, so Get Started, Tools and Settings were out of reach there. */}
      <div
        id={panelId}
        role="group"
        aria-label="More"
        hidden={!open}
        className="absolute bottom-full right-0 z-[var(--z-popover)] mb-2 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40 [&[hidden]]:hidden"
      >
        {children}
      </div>
    </div>
  );
}
