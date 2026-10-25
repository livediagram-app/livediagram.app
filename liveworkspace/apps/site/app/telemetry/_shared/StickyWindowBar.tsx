'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import type { TelemetryWindowKey } from '@liveworkspace/telemetry';
import { Glyph } from '@livediagram/ui';
import { Tooltip, useMenu, useMenuButton } from '@liveworkspace/ui';
import { WINDOW_META } from './windows';

// Three dots — the "more / switch view" affordance in the sticky bar.
function EllipsisIcon() {
  return (
    <Glyph size={16} units={16} filled>
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
    </Glyph>
  );
}

type ViewOption = { key: string; label: string; icon: ReactNode };

// A condensed version of the WindowPanel's Today / Last 7 days / Last 30 days
// selector. It fades in, fixed just below the sticky site header, once the
// full panel has scrolled out of view, so the active timeframe stays
// changeable while the reader is deep in a long list. An IntersectionObserver
// on the panel drives the show/hide; no scroll listener.
//
// To its right, an ellipsis menu switches the active view (Dashboard,
// Pages, Search, …) — the tab row also scrolls away, so this keeps the
// "which lens" control reachable too. The timeframe buttons stay inline
// (out of the menu); only the view picker collapses into the ellipsis.
export function StickyWindowBar({
  watchRef,
  active,
  onSelect,
  views,
  view,
  onSelectView,
}: {
  watchRef: RefObject<HTMLElement | null>;
  active: TelemetryWindowKey;
  onSelect: (key: TelemetryWindowKey) => void;
  views: ViewOption[];
  view: string;
  onSelectView: (key: string) => void;
}) {
  const [stuck, setStuck] = useState(false);
  // A menu button (docs/specs/004-interface-design/menus.md); keys and focus come from the hooks.
  const {
    open: menuOpen,
    close: closeMenu,
    toggle,
    trigger,
    setTrigger,
    onTriggerKeyDown,
  } = useMenuButton();

  useEffect(() => {
    const el = watchRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        // Visible only once the panel has scrolled ABOVE the viewport
        // (its box sits past the top), not when it's still below the fold.
        const next = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setStuck(next);
        // Close the view menu as the bar hides (e.g. scrolling back up).
        // Done here rather than in an effect keyed on `stuck`: this callback
        // is where the transition actually happens, so there is no second
        // render pass just to observe our own state change.
        if (!next) closeMenu();
      },
      // Negative top margin ≈ the sticky SiteHeader height, so the bar
      // appears as the panel slips under the header rather than off-screen.
      { rootMargin: '-80px 0px 0px 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [watchRef, closeMenu]);

  const activeView = views.find((v) => v.key === view);
  const viewPickerLabel = activeView ? `Switch view, now ${activeView.label}` : 'Switch view';

  return (
    <div
      // Hidden and out of the tab order until it fades in: aria-hidden alone left its buttons focusable.
      inert={!stuck}
      className={
        'fixed inset-x-0 top-24 z-30 flex justify-center px-2 transition-all duration-short sm:px-4 ' +
        (stuck ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0')
      }
    >
      {/* Below `sm` the pills drop to 10px side padding and their short names, so the bar fits a 320px
          phone (in full it ran 8px past a 390px screen); on a touch screen each is 44px tall to tap
          (touch-targets.md). */}
      <div className="inline-flex items-center gap-1 rounded-full border sm:gap-1.5 border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10">
        {WINDOW_META.map((w) => {
          const isActive = active === w.key;
          return (
            <button
              key={w.key}
              type="button"
              onClick={() => onSelect(w.key)}
              aria-pressed={isActive}
              aria-label={w.label}
              className={
                'relative cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-semibold transition touch-target-y sm:px-4 ' +
                (isActive
                  ? 'bg-brand-700 text-white shadow-sm dark:bg-brand-600'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              <span className="sm:hidden">{w.short}</span>
              <span className="max-sm:hidden">{w.label}</span>
            </button>
          );
        })}

        {/* Divider, then the view (category) picker. */}
        <span aria-hidden className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="relative">
          {/* The glyph alone shows the current view, so the name says it too. */}
          <Tooltip label={viewPickerLabel}>
            <button
              type="button"
              ref={setTrigger}
              onClick={toggle}
              onKeyDown={onTriggerKeyDown}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={viewPickerLabel}
              className={
                'relative flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition touch-target-y sm:px-3 ' +
                (menuOpen
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              {activeView ? (
                <span aria-hidden className="[&_svg]:h-3.5 [&_svg]:w-3.5">
                  {activeView.icon}
                </span>
              ) : null}
              <EllipsisIcon />
            </button>
          </Tooltip>

          {menuOpen ? (
            <>
              {/* Click-away backdrop. */}
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={closeMenu}
                className="fixed inset-0 z-10 cursor-default"
              />
              <ViewMenu trigger={trigger} onClose={closeMenu}>
                {views.map((v) => {
                  const isCurrent = v.key === view;
                  return (
                    <button
                      key={v.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isCurrent}
                      tabIndex={-1}
                      onClick={() => {
                        onSelectView(v.key);
                        closeMenu();
                      }}
                      className={
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ' +
                        (isCurrent
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                          : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800')
                      }
                    >
                      <span aria-hidden className="[&_svg]:h-4 [&_svg]:w-4">
                        {v.icon}
                      </span>
                      <span className="flex-1 truncate">{v.label}</span>
                      {isCurrent ? (
                        <span aria-hidden className="text-xs">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </ViewMenu>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ViewMenu({
  trigger,
  onClose,
  children,
}: {
  trigger: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const { attach, surfaceProps } = useMenu({ onClose, trigger });
  return (
    <div
      ref={attach}
      {...surfaceProps}
      className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-xl outline-none ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10"
    >
      {children}
    </div>
  );
}
