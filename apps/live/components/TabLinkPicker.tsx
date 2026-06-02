import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Portal } from './Portal';
import type { Tab } from '@livediagram/diagram';
import { clampToViewport } from '@/lib/clamp-to-viewport';

// A diagram summary as the picker needs it (id + display name only).
// Trimmed from the larger DiagramSummary so the picker doesn't pull
// the full owner / saved-at / share fields it doesn't render.
export type LinkPickerDiagram = { id: string; name: string };

type TabLinkPickerProps = {
  anchor: HTMLElement | null;
  tabs: Tab[];
  currentTabId: string;
  linkedTabId: string | null;
  // Up to 5 of the user's most-recently-saved diagrams (excluding
  // the current one). Surfaces as the second section of the picker:
  // "Link to diagram". Omit to hide the section entirely (e.g. when
  // there's no diagram list available, like a visitor on a share
  // link).
  recentDiagrams?: LinkPickerDiagram[];
  // Currently-linked diagram id (when the existing link kind is
  // 'diagram'). Drives the active highlight in the diagram section.
  linkedDiagramId: string | null;
  onSelect: (tabId: string) => void;
  // Pick a diagram from the recent list. The caller is responsible
  // for committing the link kind: 'diagram' on the element.
  onSelectDiagram?: (diagram: LinkPickerDiagram) => void;
  onClear: () => void;
  onClose: () => void;
};

// Portal-rendered tab picker for setting an element's cross-tab link.
// Lists every other tab; the current tab is excluded since linking to
// yourself wouldn't navigate anywhere.
export function TabLinkPicker({
  anchor,
  tabs,
  currentTabId,
  linkedTabId,
  recentDiagrams,
  linkedDiagramId,
  onSelect,
  onSelectDiagram,
  onClear,
  onClose,
}: TabLinkPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!anchor) return;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      setPos({ left: r.left + r.width / 2, top: r.top });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !pos) return;
    const next = clampToViewport(node.getBoundingClientRect(), adjust);
    if (next.x !== adjust.x || next.y !== adjust.y) setAdjust(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target) && e.target !== anchor) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchor]);

  if (!pos) return null;

  const otherTabs = tabs.filter((t) => t.id !== currentTabId);

  return (
    <Portal>
      <div
        ref={ref}
        role="menu"
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-50 flex w-56 animate-fade-in flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
        style={{
          left: pos.left + adjust.x,
          top: pos.top + adjust.y,
          transform: 'translate(-50%, calc(-100% - 8px))',
        }}
      >
        <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Link to tab
        </p>
        {otherTabs.length === 0 ? (
          <p className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
            No other tabs to link to.
          </p>
        ) : (
          otherTabs.map((tab) => {
            const isActive = tab.id === linkedTabId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelect(tab.id)}
                className={
                  isActive
                    ? 'flex items-center gap-2 rounded-md bg-brand-100 px-2 py-1.5 text-left text-xs font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                    : 'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }
              >
                <span className="truncate flex-1">{tab.name}</span>
                {isActive ? <CheckIcon /> : null}
              </button>
            );
          })
        )}
        {recentDiagrams && recentDiagrams.length > 0 && onSelectDiagram ? (
          <>
            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
            <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Link to diagram
            </p>
            {recentDiagrams.map((d) => {
              const isActive = d.id === linkedDiagramId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDiagram(d)}
                  className={
                    isActive
                      ? 'flex items-center gap-2 rounded-md bg-brand-100 px-2 py-1.5 text-left text-xs font-medium text-brand-700'
                      : 'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100'
                  }
                >
                  <span className="truncate flex-1">{d.name || 'Untitled diagram'}</span>
                  {isActive ? <CheckIcon /> : null}
                </button>
              );
            })}
          </>
        ) : null}
        {linkedTabId || linkedDiagramId ? (
          <>
            <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/15"
            >
              Remove link
            </button>
          </>
        ) : null}
      </div>
    </Portal>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path
        d="M3 6l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
