import { useState } from 'react';
import { CloseIcon } from './CloseIcon';
import { useEscape } from '@/hooks/useEscape';
import type { ElementLink } from '@livediagram/diagram';

// Shared link picker, styled like the import / export dialogs (centred
// modal, brand chrome). Used for BOTH element links and per-cell table
// links (spec/09). Three modes — link to a Tab, another Diagram, or an
// external URL — plus a Remove action when a link already exists.
//
// Generic by design: the dialog builds the chosen `ElementLink` and
// hands it back via `onCommit` (null = remove). The caller decides where
// it lands (an element's `link`, or a table cell's `cellStyles.link`).

type LinkTarget = { id: string; name: string };

type LinkPickerDialogProps = {
  // What's being linked, for the header ("Link element" / "Link cell").
  title: string;
  // The link currently on the target, or null. Seeds the active mode +
  // the URL field, and reveals the Remove button.
  currentLink: ElementLink | null;
  // Tabs in this diagram. The current tab is marked but still selectable
  // (a cell may legitimately link back to its own tab's start).
  tabs: LinkTarget[];
  currentTabId: string;
  // The caller's other diagrams (newest first), for the Diagram mode.
  recentDiagrams: LinkTarget[];
  // Pre-select a mode (the context menu's split Link entries open the modal
  // straight onto webpage / tab / diagram). Falls back to the current link's
  // kind, then 'url', when unset.
  initialMode?: 'tab' | 'diagram' | 'url';
  onCommit: (link: ElementLink | null) => void;
  onClose: () => void;
};

type Mode = 'tab' | 'diagram' | 'url';

const MODES: { id: Mode; label: string }[] = [
  { id: 'url', label: 'External URL' },
  { id: 'tab', label: 'Tab' },
  { id: 'diagram', label: 'Diagram' },
];

// Prepend https:// to a bare host (no scheme). Leaves mailto:, http(s)://
// etc. untouched so the user can paste any address.
function normaliseUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
}

export function LinkPickerDialog({
  title,
  currentLink,
  tabs,
  currentTabId,
  recentDiagrams,
  initialMode,
  onCommit,
  onClose,
}: LinkPickerDialogProps) {
  useEscape(onClose);
  // A caller-requested mode wins; otherwise open on the existing link's mode,
  // else External URL.
  const [mode, setMode] = useState<Mode>(
    initialMode ??
      (currentLink?.kind === 'diagram'
        ? 'diagram'
        : currentLink?.kind === 'tab' || currentLink?.kind === 'element'
          ? 'tab'
          : 'url'),
  );
  const [urlInput, setUrlInput] = useState(currentLink?.kind === 'url' ? currentLink.url : '');

  const commit = (link: ElementLink | null) => {
    onCommit(link);
    onClose();
  };

  const saveUrl = () => {
    const url = normaliseUrl(urlInput);
    if (!url) return;
    commit({ kind: 'url', url });
  };

  const linkedTabId =
    currentLink?.kind === 'tab' || currentLink?.kind === 'element' ? currentLink.tabId : null;
  const linkedDiagramId = currentLink?.kind === 'diagram' ? currentLink.diagramId : null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm dark:bg-slate-950/60"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="pointer-events-auto flex max-h-[90vh] w-[34rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Jump to a tab, open another diagram, or go to a web address.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Mode switcher */}
        <div className="flex gap-1 border-b border-slate-100 px-6 py-3 dark:border-slate-800">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={
                mode === m.id
                  ? 'rounded-md bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
                  : 'rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {mode === 'tab' ? (
            <ul className="flex flex-col gap-1">
              {tabs.map((t) => (
                <li key={t.id}>
                  <RowButton
                    active={linkedTabId === t.id}
                    icon={<TabGlyph />}
                    onClick={() => commit({ kind: 'tab', tabId: t.id })}
                  >
                    <span className="truncate">{t.name}</span>
                    {t.id === currentTabId ? (
                      <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                        current
                      </span>
                    ) : null}
                  </RowButton>
                </li>
              ))}
            </ul>
          ) : mode === 'diagram' ? (
            recentDiagrams.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-10 text-center">
                <DiagramGlyph muted />
                <p className="text-xs text-slate-400 dark:text-slate-400">No other diagrams yet.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
                {recentDiagrams.map((d) => (
                  <li key={d.id}>
                    <RowButton
                      active={linkedDiagramId === d.id}
                      icon={<DiagramGlyph />}
                      onClick={() => commit({ kind: 'diagram', diagramId: d.id, name: d.name })}
                    >
                      <span className="truncate">{d.name}</span>
                    </RowButton>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Web address
              </label>
              <input
                type="url"
                inputMode="url"
                autoFocus
                value={urlInput}
                placeholder="https://example.com"
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveUrl();
                  }
                }}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-400">
                Opens in a new tab. We&apos;ll add https:// if you leave off the scheme.
              </p>
              <button
                type="button"
                onClick={saveUrl}
                disabled={!urlInput.trim()}
                className="mt-1 self-start rounded-md bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save link
              </button>
            </div>
          )}
        </div>

        {currentLink ? (
          <div className="flex justify-end border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => commit(null)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/15"
            >
              Remove link
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RowButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'flex w-full items-center gap-2.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-left text-sm font-medium text-brand-800 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-200'
          : 'flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
      }
    >
      <span
        className={
          active
            ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200'
            : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
        }
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 items-center">{children}</span>
      {active ? <CheckGlyph /> : null}
    </button>
  );
}

function TabGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h3l1.2 1.5H12.5A1.5 1.5 0 0 1 14 7v4.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z" />
    </svg>
  );
}

function DiagramGlyph({ muted }: { muted?: boolean }) {
  return (
    <svg
      width={muted ? 28 : 14}
      height={muted ? 28 : 14}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
      className={muted ? 'text-slate-300 dark:text-slate-400' : undefined}
    >
      <rect x="2" y="2.5" width="5" height="4" rx="1" />
      <rect x="9" y="9.5" width="5" height="4" rx="1" />
      <path d="M4.5 6.5v3.5a1 1 0 0 0 1 1H9" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M3.5 8.5l3 3 6-6.5" />
    </svg>
  );
}
