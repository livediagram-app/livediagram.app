import type { ReactNode, RefObject } from 'react';

export type DockPanelId = 'explorer' | 'palette' | 'collaborate' | 'ai';

// Top-right mobile dock (spec/07 "Mobile chrome"): a compact button row
// that replaces the four full-width collapse banners on mobile, opening
// each panel as a popover. Also shown at all widths when the user opts
// into the minimal panel layout (spec/09). Split out of Canvas.tsx; the
// popover bodies + anchoring stay in Canvas, this is just the button row.
export function CanvasMobileDock({
  welcomeOpen,
  minimalPanels,
  readOnly,
  hasCollaborate,
  hasAi,
  activeMobilePanel,
  dockButtonRefs,
  onDockButtonClick,
}: {
  welcomeOpen: boolean;
  minimalPanels?: boolean;
  readOnly: boolean;
  // True when the active tab has at least one comment thread or action —
  // the same gate that mounts the Collaborate panel (spec/68 §5).
  hasCollaborate: boolean;
  hasAi: boolean;
  activeMobilePanel: DockPanelId | null;
  dockButtonRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  onDockButtonClick: (id: DockPanelId) => void;
}) {
  if (welcomeOpen) return null;
  return (
    <div
      data-mobile-dock
      className={`pointer-events-auto absolute top-3 right-3 z-[var(--z-toolbar)] flex items-stretch rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900${minimalPanels ? '' : ' sm:hidden'}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {(
        [
          {
            id: 'explorer',
            label: 'Explorer',
            icon: (
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M2 3.5C2 2.67 2.67 2 3.5 2h2.25l1.5 1.5H10.5c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5h-7C2.67 11.5 2 10.83 2 10V3.5z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            ),
          },
          ...(!readOnly
            ? [
                {
                  id: 'palette' as const,
                  label: 'Palette',
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <rect
                        x="2"
                        y="2"
                        width="4"
                        height="4"
                        rx="0.8"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <rect
                        x="8"
                        y="2"
                        width="4"
                        height="4"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <rect
                        x="2"
                        y="8"
                        width="4"
                        height="4"
                        rx="0.8"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <path
                        d="M10 8v4M8 10h4"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  ),
                },
              ]
            : []),
          ...(hasCollaborate
            ? [
                {
                  id: 'collaborate' as const,
                  label: 'Collaborate',
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path
                        d="M2 4.2C2 3.26 2.76 2.5 3.7 2.5h6.6c.94 0 1.7.76 1.7 1.7v3.1c0 .94-.76 1.7-1.7 1.7H7.2L4.7 11V9H3.7C2.76 9 2 8.24 2 7.3V4.2z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4.8 5.75h4.4"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  ),
                },
              ]
            : []),
          ...(!readOnly && hasAi
            ? [
                {
                  id: 'ai' as const,
                  label: 'AI',
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path
                        d="M7 2v1.5M7 10.5V12M2 7h1.5M10.5 7H12M3.8 3.8l1 1M9.2 9.2l1 1M3.8 10.2l1-1M9.2 4.8l1-1"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  ),
                },
              ]
            : []),
        ] as {
          id: DockPanelId;
          label: string;
          icon: ReactNode;
        }[]
      ).map((btn, i, arr) => (
        <button
          key={btn.id}
          ref={(el) => {
            dockButtonRefs.current[btn.id] = el;
          }}
          type="button"
          onClick={() => onDockButtonClick(btn.id)}
          className={
            'flex min-w-[3.25rem] flex-1 flex-col items-center gap-1 px-3.5 py-2.5 text-[10px] font-semibold tracking-wide transition ' +
            (i === 0 ? 'rounded-l-lg ' : '') +
            (i === arr.length - 1 ? 'rounded-r-lg ' : '') +
            (i > 0 ? 'border-l border-slate-200 dark:border-slate-800 ' : '') +
            (activeMobilePanel === btn.id
              ? 'bg-brand-500 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
          }
        >
          {btn.icon}
          {btn.label}
        </button>
      ))}
    </div>
  );
}
