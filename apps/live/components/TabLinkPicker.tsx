import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Tab } from '@livediagram/diagram';
import { clampToViewport } from '@/lib/clamp-to-viewport';

type TabLinkPickerProps = {
  anchor: HTMLElement | null;
  tabs: Tab[];
  currentTabId: string;
  linkedTabId: string | null;
  onSelect: (tabId: string) => void;
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
  onSelect,
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

  if (typeof document === 'undefined' || !pos) return null;

  const otherTabs = tabs.filter((t) => t.id !== currentTabId);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-50 flex w-56 animate-fade-in flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10"
      style={{
        left: pos.left + adjust.x,
        top: pos.top + adjust.y,
        transform: 'translate(-50%, calc(-100% - 8px))',
      }}
    >
      <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Link to tab
      </p>
      {otherTabs.length === 0 ? (
        <p className="px-2 py-2 text-xs text-slate-500">No other tabs to link to.</p>
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
                  ? 'flex items-center gap-2 rounded-md bg-brand-100 px-2 py-1.5 text-left text-xs font-medium text-brand-700'
                  : 'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100'
              }
            >
              <span className="truncate flex-1">{tab.name}</span>
              {isActive ? (
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
              ) : null}
            </button>
          );
        })
      )}
      {linkedTabId ? (
        <>
          <div className="my-1 h-px bg-slate-100" />
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-rose-700 transition hover:bg-rose-50"
          >
            Remove link
          </button>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
