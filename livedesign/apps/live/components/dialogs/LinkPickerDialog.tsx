import { useState } from 'react';
import {
  Button,
  CompactEmptyState,
  TextInput,
  Glyph,
  DialogCloseButton,
  DialogHeader,
} from '@livedesign/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { normaliseUrl } from '@liveworkspace/workbench/lib/url-safety';
import { isScreenLink, type ElementLink } from '@livedesign/design';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import type { ScreenChoice } from '@/lib/screen-link-choices';
import type { LinkPickerMode } from '@/hooks/canvas/useElementLinks';
import { RowButton } from './link-picker-rows';
import { ScreenLinkMode } from './ScreenLinkMode';

// Shared link picker, styled like the import / export dialogs (centred
// modal, brand chrome). Used for BOTH element links and per-cell table
// links (docs/specs/008-canvas/canvas-and-palette.md). Three modes (link to a Tab, another Design, or an
// external URL), plus a Remove action when a link already exists. On a wireframe tab a fourth, Screen, comes first
// (docs/specs/007-editor/wireframe-pages.md "Setting a link").
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
  // Tabs in this design. The current tab is marked but still selectable
  // (a cell may legitimately link back to its own tab's start).
  tabs: LinkTarget[];
  currentTabId: string;
  // The caller's other designs (newest first), for the Design mode.
  recentDesigns: LinkTarget[];
  // Pre-select a mode (the context menu's split Link entries open the modal
  // straight onto webpage / tab / design). Falls back to the current link's
  // kind, then 'url', when unset.
  initialMode?: LinkPickerMode;
  // A wireframe tab's screens (docs/specs/007-editor/wireframe-pages.md "Setting a link"): present, the dialog
  // offers a Screen mode first and opens on it unless the element holds a link of another kind. Absent (another
  // kind of tab, or someone who may not link the element), the Screen mode is not offered.
  screens?: readonly ScreenChoice[];
  // The Screen mode alone, no switcher: a Participant's, on its own element.
  screenOnly?: boolean;
  // Restricts the dialog to the URL mode, with caller-supplied copy and
  // validation. For an element whose link IS its content — a video's YouTube
  // URL (docs/specs/009-elements/youtube-video.md) — the tab and design modes are not a narrower choice, they
  // are a meaningless one: a video pointed at a tab has nothing to play.
  urlOnly?: UrlOnlyConfig;
  onCommit: (link: ElementLink | null) => void;
  onClose: () => void;
};

type UrlOnlyConfig = {
  // Replaces the header's "Jump to a tab, open another design, ..." line.
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

type Mode = LinkPickerMode;

const MODES: { id: Mode; label: string }[] = [
  { id: 'url', label: 'External URL' },
  { id: 'tab', label: 'Tab' },
  { id: 'design', label: 'Design' },
];
const SCREEN_MODE: { id: Mode; label: string } = { id: 'screen', label: 'Screen' };

/** The mode the dialog opens on: the caller's, else the current link's, else Screen on a wireframe tab, else URL. */
export function initialLinkPickerMode(input: {
  currentLink: ElementLink | null;
  initialMode?: Mode;
  urlOnly: boolean;
  hasScreens: boolean;
  screenOnly: boolean;
}): Mode {
  const { currentLink, hasScreens } = input;
  if (input.urlOnly) return 'url';
  if (input.screenOnly && hasScreens) return 'screen';
  const asked = input.initialMode === 'screen' && !hasScreens ? undefined : input.initialMode;
  if (asked) return asked;
  if (currentLink?.kind === 'design') return 'design';
  if (currentLink?.kind === 'tab' || currentLink?.kind === 'element') return 'tab';
  if (hasScreens && (!currentLink || isScreenLink(currentLink))) return 'screen';
  return 'url';
}

export function LinkPickerDialog({
  title,
  currentLink,
  tabs,
  currentTabId,
  recentDesigns,
  initialMode,
  urlOnly,
  screens,
  screenOnly = false,
  onCommit,
  onClose,
}: LinkPickerDialogProps) {
  const hasScreens = !!screens && !urlOnly;
  const onlyScreens = hasScreens && screenOnly;
  // A caller-requested mode wins; otherwise open on the existing link's mode, else Screen on a wireframe tab, else
  // External URL.
  const [mode, setMode] = useState<Mode>(() =>
    initialLinkPickerMode({
      currentLink,
      initialMode,
      urlOnly: !!urlOnly,
      hasScreens,
      screenOnly: onlyScreens,
    }),
  );
  const modes = hasScreens ? [SCREEN_MODE, ...MODES] : MODES;
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
  const linkedDesignId = currentLink?.kind === 'design' ? currentLink.designId : null;

  return (
    <Dialog open onClose={onClose} ariaLabel={title} size="lg" className="max-h-[90vh]">
      <DialogHeader
        title={title}
        subtitle={
          urlOnly
            ? urlOnly.subtitle
            : onlyScreens
              ? 'Pick the screen pressing this element goes to in Prototype mode.'
              : hasScreens
                ? 'Go to another screen, jump to a tab, open another design, or go to a web address.'
                : 'Jump to a tab, open another design, or go to a web address.'
        }
      >
        {/* A URL-restricted picker is an embed's link dialog (docs/specs/009-elements/embed-providers.md), so
            it points at the embed article rather than the generic links one:
            "which links work here" is the question being asked. */}
        <HelpArticleLink
          size="md"
          article={urlOnly ? 'embedElements' : mode === 'tab' ? 'linkingTabs' : 'links'}
        />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>

      {/* Mode switcher — hidden entirely when the caller restricts to a URL:
          a one-button switcher is a control that can't do anything. */}
      {urlOnly || onlyScreens ? null : (
        <div className="flex gap-1 border-b border-slate-100 px-6 py-3 dark:border-slate-800">
          {modes.map((m) => (
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
        {mode === 'screen' && screens ? (
          <ScreenLinkMode screens={screens} currentLink={currentLink} onCommit={commit} />
        ) : mode === 'tab' ? (
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
                    <span className="inline-flex items-center ml-2 shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      <span className="text-optical-line text-optical-caps [--optical-tracking:0.025em]">
                        current
                      </span>
                    </span>
                  ) : null}
                </RowButton>
              </li>
            ))}
          </ul>
        ) : mode === 'design' ? (
          recentDesigns.length === 0 ? (
            <CompactEmptyState
              className="py-10"
              icon={<DesignGlyph />}
              title="No other designs yet"
              description="Make another design to link to it."
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {recentDesigns.map((d) => (
                <li key={d.id}>
                  <RowButton
                    active={linkedDesignId === d.id}
                    icon={<DesignGlyph />}
                    onClick={() => commit({ kind: 'design', designId: d.id, name: d.name })}
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
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
            className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            Remove link
          </button>
        </DialogFooter>
      ) : null}
    </Dialog>
  );
}

function TabGlyph() {
  return (
    <Glyph size={14} units={16} strokeLinecap="butt">
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h3l1.2 1.5H12.5A1.5 1.5 0 0 1 14 7v4.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z" />
    </Glyph>
  );
}

function DesignGlyph() {
  return (
    <Glyph size={14} units={16} strokeLinecap="butt">
      <rect x="2" y="2.5" width="5" height="4" rx="1" />
      <rect x="9" y="9.5" width="5" height="4" rx="1" />
      <path d="M4.5 6.5v3.5a1 1 0 0 0 1 1H9" />
    </Glyph>
  );
}
