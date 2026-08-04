import { useState } from 'react';
import { Button, TextInput } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { normaliseUrl } from '@/lib/url-safety';
import type { ElementLink } from '@livediagram/diagram';
import { DialogHeader } from './DialogHeader';
import { DialogFooter } from '@/components/dialogs/DialogFooter';

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
  // Restricts the dialog to the URL mode, with caller-supplied copy and
  // validation. For an element whose link IS its content — a video's YouTube
  // URL (spec/114) — the tab and diagram modes are not a narrower choice, they
  // are a meaningless one: a video pointed at a tab has nothing to play.
  urlOnly?: UrlOnlyConfig;
  onCommit: (link: ElementLink | null) => void;
  onClose: () => void;
};

export type UrlOnlyConfig = {
  // Replaces the header's "Jump to a tab, open another diagram, ..." line.
  subtitle: string;
  fieldLabel: string;
  placeholder: string;
  // Sits under the field, replacing the generic "Opens in a new tab" note.
  hint: string;
  // Returns a message when the URL is not acceptable, or null when it is.
  // Runs on the NORMALISED url (so a bare host has gained its https://),
  // matching what would actually be stored.
  validate: (url: string) => string | null;
};

type Mode = 'tab' | 'diagram' | 'url';

const MODES: { id: Mode; label: string }[] = [
  { id: 'url', label: 'External URL' },
  { id: 'tab', label: 'Tab' },
  { id: 'diagram', label: 'Diagram' },
];

export function LinkPickerDialog({
  title,
  currentLink,
  tabs,
  currentTabId,
  recentDiagrams,
  initialMode,
  urlOnly,
  onCommit,
  onClose,
}: LinkPickerDialogProps) {
  // A caller-requested mode wins; otherwise open on the existing link's mode,
  // else External URL.
  const [mode, setMode] = useState<Mode>(
    (urlOnly ? 'url' : undefined) ??
      initialMode ??
      (currentLink?.kind === 'diagram'
        ? 'diagram'
        : currentLink?.kind === 'tab' || currentLink?.kind === 'element'
          ? 'tab'
          : 'url'),
  );
  const [urlInput, setUrlInput] = useState(currentLink?.kind === 'url' ? currentLink.url : '');
  // The validation message for what's typed so far, or null. Computed rather
  // than held in state so it can't go stale against the field.
  const typed = urlInput.trim();
  const urlError = urlOnly && typed ? urlOnly.validate(normaliseUrl(typed) ?? typed) : null;

  const commit = (link: ElementLink | null) => {
    onCommit(link);
    onClose();
  };

  const saveUrl = () => {
    const url = normaliseUrl(urlInput);
    if (!url) return;
    // The same validator the field shows, run again at the point of commit so
    // an Enter keypress can't slip past a message the user hasn't read.
    if (urlOnly?.validate(url)) return;
    commit({ kind: 'url', url });
  };

  const linkedTabId =
    currentLink?.kind === 'tab' || currentLink?.kind === 'element' ? currentLink.tabId : null;
  const linkedDiagramId = currentLink?.kind === 'diagram' ? currentLink.diagramId : null;

  return (
    <Dialog open onClose={onClose} ariaLabel={title} size="lg" className="max-h-[90vh]">
      <DialogHeader
        title={title}
        subtitle={
          urlOnly
            ? urlOnly.subtitle
            : 'Jump to a tab, open another diagram, or go to a web address.'
        }
      >
        {/* A URL-restricted picker is an embed's link dialog (spec/121), so
            it points at the embed article rather than the generic links one:
            "which links work here" is the question being asked. */}
        <HelpArticleLink
          article={urlOnly ? 'embedElements' : mode === 'tab' ? 'linkingTabs' : 'links'}
          title={urlOnly ? 'Embeds' : mode === 'tab' ? 'Linking tabs' : 'Links'}
          description={
            urlOnly
              ? 'Which services can be embedded, and how they load.'
              : mode === 'tab'
                ? 'How linking to another tab works.'
                : 'Linking elements to tabs, diagrams, and web addresses.'
          }
        />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>

      {/* Mode switcher — hidden entirely when the caller restricts to a URL:
          a one-button switcher is a control that can't do anything. */}
      {urlOnly ? null : (
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
      )}

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
              {urlOnly ? urlOnly.fieldLabel : 'Web address'}
            </label>
            <TextInput
              type="url"
              inputMode="url"
              autoFocus
              value={urlInput}
              placeholder={urlOnly ? urlOnly.placeholder : 'https://example.com'}
              aria-invalid={!!urlError}
              aria-describedby={urlError ? 'link-picker-url-error' : undefined}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveUrl();
                }
              }}
            />
            {urlError ? (
              <p
                id="link-picker-url-error"
                className="text-[11px] font-medium text-rose-600 dark:text-rose-400"
              >
                {urlError}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-400">
                {urlOnly
                  ? urlOnly.hint
                  : "Opens in a new tab. We'll add https:// if you leave off the scheme."}
              </p>
            )}
            <Button
              size="xs"
              onClick={saveUrl}
              disabled={!typed || !!urlError}
              className="mt-1 self-start shadow-sm"
            >
              Save link
            </Button>
          </div>
        )}
      </div>

      {currentLink ? (
        <DialogFooter>
          <button
            type="button"
            onClick={() => commit(null)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/15"
          >
            Remove link
          </button>
        </DialogFooter>
      ) : null}
    </Dialog>
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
