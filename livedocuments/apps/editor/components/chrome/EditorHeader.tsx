import { useState, type ReactNode } from 'react';
import { NameEditor } from '@/components/primitives/NameEditor';
import {
  Brand,
  HoverCard,
  SOLID_BRAND_DARK_CONTROL,
  Glyph,
  safeInlinePadding,
  safeInset,
  SITE_ID,
  SiteSwitcher,
} from '@livedocuments/ui';
import { AuthControls } from '@/components/chrome/AuthControls';
import { SharedBadge } from '@/components/chrome/SharedBadge';
import {
  HEADER_ACTION_BTN,
  HeaderGlyph,
} from '@liveworkspace/workbench/components/chrome/header-action';
import { EXPLORER_LANDING_PATH } from '@/lib/explorer-landing';

// The autosave's sync state. No header pill shows it any more: the failure
// states each raise a toast (editor-persistence.ts), so silent failures
// (offline, API down, wrong env var pointing at unreachable host) never
// look identical to a successful save.
// 'error' is a save that FAILED and may well work next time (offline, a
// blip, a 5xx). 'forbidden' is a save the server refused outright — the
// share link was revoked, we were removed from the team — which no amount
// of retrying fixes, so it gets its own state and its own wording rather
// than telling the user to check a connection that is fine. 'unauthenticated'
// is a save the server could not tie to the signed-in account (a 401, or no
// session token to send); it is retried, since the session can come back.
// 'tooLarge' is a tab over the server's row cap (a 413): only an edit that
// shrinks it can save, so it is not retried on a timer.
export type SaveStatus =
  'idle' | 'saving' | 'saved' | 'error' | 'unauthenticated' | 'forbidden' | 'tooLarge';

type EditorHeaderProps = {
  documentName: string;
  // Hides the centred document title while the first-run welcome modal
  // is up (no document exists yet, naming it makes no sense). Brand and
  // Share button stay.
  hideTitle?: boolean;
  // Only the document's owner sees the Share button — visitors arriving
  // via a share URL can't toggle sharing on their host's document.
  showShare: boolean;
  shareable: boolean;
  // The document lives in a team's shared library (docs/specs/013-workspace/team-shared-documents.md). Flips the
  // title badge to "Team" when the document has no share links.
  teamDocument?: boolean;
  // Offline Mode (docs/specs/006-document/offline-mode.md): saved only in this browser. Flips the title badge
  // to "This Browser" (superseding "Private"); the caller also hides Share.
  offline?: boolean;
  // Listed in the public Community (docs/specs/025-community/community.md): the badge reads "Public".
  community?: boolean;
  // Counterpart to showShare for visitors: when present we render a
  // "Make a copy" button that duplicates the document into the
  // visitor's own files (item #9 / docs/specs/015-api/api.md). Optional so the owner
  // view stays unchanged.
  onMakeCopy?: () => void;
  copying?: boolean;
  // True for a view-only ('view' share role) session. Disables the
  // click-to-rename affordance on the document title — the viewer
  // isn't allowed to rename someone else's document. Make-a-copy +
  // Share gates already handle their own visibility.
  readOnly?: boolean;
  onOpenShare: () => void;
  // Opens the editor's Settings on its Account category (the account menu's
  // Account item), so it doesn't navigate away from the document.
  onOpenAccount?: () => void;
  onRename: (name: string) => void;
  // Bumped by the command palette's "Rename document" action to enter inline
  // edit mode (the palette can't reach this component's local editing state).
  // A monotonic counter; each increment opens the editor (unless read-only).
  renameNonce?: number;
  // The role pill (docs/specs/007-editor/editor-app.md#role-pill), after the visibility badge.
  rolePill?: ReactNode;
  // The Present button (docs/specs/012-collaboration/presentation-mode.md "The header's Present
  // button"): passed only while the deck has a presentable slide, so absent means no button.
  present?: { slideCount: number; starting: boolean; onPresent: () => void };
};

export function EditorHeader({
  documentName,
  hideTitle = false,
  showShare,
  shareable,
  teamDocument = false,
  offline = false,
  community = false,
  onMakeCopy,
  copying = false,
  readOnly = false,
  onOpenShare,
  onOpenAccount,
  onRename,
  renameNonce = 0,
  rolePill,
  present,
}: EditorHeaderProps) {
  const [editing, setEditing] = useState(false);

  // The command palette requests a rename by bumping renameNonce. Each request is
  // honoured once, as soon as the title can be edited (it may be hidden behind the
  // welcome modal when it arrives); the mount value is never a request.
  const [handledNonce, setHandledNonce] = useState(renameNonce);
  if (renameNonce !== handledNonce && !readOnly && !hideTitle) {
    setHandledNonce(renameNonce);
    setEditing(true);
  }

  return (
    // `relative z-[var(--z-modal)]` puts the entire header into its own stacking
    // context above the canvas sibling that follows it. Without it,
    // AuthControls's absolute-positioned dropdown menu (which
    // overflows the header bounds downward) was getting hidden
    // behind the canvas — siblings without explicit z-index stack in
    // document order and the canvas wins.
    <header
      data-region="header"
      // The app's own colours, whatever the tab's style (docs/specs/011-theme/canvas-and-theme-dialog.md).
      data-app-chrome
      // Below the status bar / notch and past a landscape notch's sides (lib/safe-area).
      style={{
        height: `calc(3.5rem + ${safeInset('top')})`,
        paddingTop: safeInset('top'),
        ...safeInlinePadding('1rem'),
      }}
      className="relative z-[var(--z-modal)] flex shrink-0 items-center justify-between gap-2 border-y border-slate-200 bg-white sm:gap-4 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex w-auto items-center gap-2.5">
        {/* The editor's logo goes up one level, to the Explorer home; the Explorer's goes to the homepage.
            Hovering it lists liveworkspace's other sites (liveworkspace/docs/specs/010-site/site-switcher.md). */}
        <SiteSwitcher current={SITE_ID}>
          <Brand
            href={EXPLORER_LANDING_PATH}
            size="md"
            wordmarkClassName="hidden sm:inline"
            className="relative touch-target"
          />
        </SiteSwitcher>
      </div>
      {/* min-w-0 down to the name, so a long name truncates instead of pushing Share and Sign in off a phone. */}
      <div className="flex min-w-0 flex-1 items-center justify-start sm:justify-center">
        {hideTitle ? null : editing && !readOnly ? (
          <NameEditor
            label="Document name"
            initial={documentName}
            onCommit={(v) => {
              onRename(v.trim() || documentName);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        ) : (
          <div className="flex min-w-0 items-center gap-1">
            {readOnly ? (
              <span className="truncate px-2 py-0.5 text-sm text-slate-600 dark:text-slate-200">
                {documentName}
              </span>
            ) : (
              <HoverCard
                title="Rename document"
                description="Click to edit the name."
                className="min-w-0"
              >
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  // 44px tall on a touch screen; padding, not a pad, since `truncate` clips a ::before.
                  className="truncate rounded px-2 py-0.5 text-sm text-slate-600 transition pointer-coarse:py-3 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {documentName}
                </button>
              </HoverCard>
            )}
            <span className="hidden sm:contents">
              <SharedBadge
                shareable={shareable}
                team={teamDocument}
                offline={offline}
                community={community}
                onManage={showShare ? onOpenShare : undefined}
              />
              {rolePill ? <span className="ml-1 inline-flex">{rolePill}</span> : null}
            </span>
          </div>
        )}
      </div>
      {/* Right-edge actions: full-height, flush to the top / bottom / right of
          the bar (the -mr-4 cancels the header's right padding). */}
      <div className="-mr-4 flex shrink-0 items-stretch self-stretch">
        {onMakeCopy ? (
          <HoverCard title="Make a copy" description="Duplicate this document into your own files.">
            <button
              type="button"
              onClick={onMakeCopy}
              disabled={copying}
              className={`${HEADER_ACTION_BTN} text-slate-600 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-brand-200`}
            >
              <HeaderGlyph>
                <CopyIcon />
              </HeaderGlyph>
              {copying ? 'Copying' : 'Copy'}
            </button>
          </HoverCard>
        ) : null}
        {present ? (
          <HoverCard
            title="Present"
            description={`Present the slide deck: ${present.slideCount} ${
              present.slideCount === 1 ? 'slide' : 'slides'
            }.`}
          >
            <button
              type="button"
              onClick={present.onPresent}
              disabled={present.starting}
              data-presentation-start="header"
              className={`${HEADER_ACTION_BTN} text-slate-600 enabled:hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:text-slate-200 dark:enabled:hover:bg-slate-800`}
            >
              <HeaderGlyph>
                <PresentIcon />
              </HeaderGlyph>
              <span>{present.starting ? 'Starting' : 'Present'}</span>
            </button>
          </HoverCard>
        ) : null}
        {showShare ? (
          <HoverCard
            title={shareable ? 'Shared' : 'Share'}
            description={shareable ? 'Click to manage links.' : 'Invite collaborators with a link.'}
          >
            <button
              type="button"
              data-tour-id="share"
              onClick={onOpenShare}
              className={`${HEADER_ACTION_BTN} ${
                shareable
                  ? `bg-brand-700 text-white hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
              aria-pressed={shareable}
            >
              <HeaderGlyph>
                <ShareIcon />
              </HeaderGlyph>
              {/* Label stays "Share" in both states — the user dislikes the
                  verb changing to "Shared". State is communicated by the
                  brand-500 fill + aria-pressed flip + the green SharedBadge by
                  the title. */}
              <span>Share</span>
            </button>
          </HoverCard>
        ) : null}
        {/* Explorer + Help used to sit here as top-right links; the product's
            surfaces now live in the Explorer panel's footer
            (docs/specs/013-workspace/explorer-structure.md "Layout"), so the
            header keeps just its primary actions. */}
        <AuthControls onOpenAccount={onOpenAccount} />
      </div>
    </header>
  );
}

function CopyIcon() {
  return (
    <Glyph size={13} units={16}>
      <rect x="5" y="5" width="8" height="8.5" rx="1.5" />
      <path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H10" />
    </Glyph>
  );
}

function PresentIcon() {
  return (
    <Glyph size={13} units={16}>
      <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" />
    </Glyph>
  );
}

function ShareIcon() {
  return (
    <Glyph size={13} units={16}>
      <circle cx="4" cy="8" r="1.6" />
      <circle cx="12" cy="3.5" r="1.6" />
      <circle cx="12" cy="12.5" r="1.6" />
      <path d="M5.4 7.2l5.2-3M5.4 8.8l5.2 3" />
    </Glyph>
  );
}
