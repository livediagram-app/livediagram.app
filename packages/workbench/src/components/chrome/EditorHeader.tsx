'use client';

import { useState, type ReactNode } from 'react';
import { Brand, type BrandApp } from '@liveworkspace/brand';
import {
  Glyph,
  HoverCard,
  SOLID_BRAND_DARK_CONTROL,
  safeInlinePadding,
  safeInset,
} from '@liveworkspace/ui';
import { NameEditor } from '../primitives/NameEditor';
import { HEADER_ACTION_BTN, HeaderGlyph } from './header-action';
import { SharedBadge } from './SharedBadge';

// The autosave's sync state. No header pill shows it any more: the failure states each raise a toast (each editor's
// editor-persistence.ts), so silent failures (offline, API down, wrong env var pointing at unreachable host) never
// look identical to a successful save.
// 'error' is a save that FAILED and may well work next time (offline, a blip, a 5xx). 'forbidden' is a save the
// server refused outright (the share link was revoked, we were removed from the team), which no amount of retrying
// fixes, so it gets its own state and its own wording rather than telling the user to check a connection that is
// fine. 'unauthenticated' is a save the server could not tie to the signed-in account (a 401, or no session token to
// send); it is retried, since the session can come back. 'tooLarge' is a tab over the server's row cap (a 413): only
// an edit that shrinks it can save, so it is not retried on a timer.
export type SaveStatus =
  'idle' | 'saving' | 'saved' | 'error' | 'unauthenticated' | 'forbidden' | 'tooLarge';

/** The words an editor's header says in its own nouns ("canvas", "plan", "design"). */
export type EditorHeaderWords = {
  // The rename field's accessible name: "Diagram name".
  nameLabel: string;
  // The title's hover card: "Rename canvas".
  renameTitle: string;
  // Make a Copy's hover card: "Duplicate this canvas into your own files."
  copyDescription: string;
  // The Present hover card's lead, before the slide count: "Present the slide deck".
  presentLead?: string;
};

export type EditorHeaderProps = {
  // Which app's logo leads the bar, and where it goes: the Explorer, on the place that holds the open item
  // (liveworkspace/docs/specs/004-index/one-explorer.md "Opening from an open item").
  app: BrandApp;
  logoHref: string;
  words: EditorHeaderWords;
  // The open item's name.
  name: string;
  // Hides the centred title while the first-run welcome modal is up (no item exists yet, naming it makes no sense).
  // Brand and Share stay.
  hideTitle?: boolean;
  // Only the item's owner sees the Share button: visitors arriving via a share URL can't toggle sharing on their
  // host's item.
  showShare: boolean;
  shareable: boolean;
  // The item lives in a team's shared library (docs/specs/013-workspace/team-shared-*.md): the title badge reads
  // "Team" when it has no share links.
  team?: boolean;
  // Offline Mode: saved only in this browser. The title badge reads "This Browser" (over "Private"); the caller also
  // hides Share.
  offline?: boolean;
  // Listed in the public Community (docs/specs/025-community/community.md): the badge reads "Public".
  community?: boolean;
  // Counterpart to showShare for visitors: when present, a Copy button duplicates the item into the visitor's own
  // files (docs/specs/015-api/api.md).
  onMakeCopy?: () => void;
  copying?: boolean;
  // A view-only session: the title is not renamed in place (the viewer may not rename someone else's item).
  readOnly?: boolean;
  onOpenShare: () => void;
  onRename: (name: string) => void;
  // Bumped by the command palette's rename action to enter inline edit mode (the palette can't reach this
  // component's local editing state). A monotonic counter; each increment opens the editor (unless read-only).
  renameNonce?: number;
  // The role pill (docs/specs/007-editor/editor-app.md#role-pill), after the visibility badge.
  rolePill?: ReactNode;
  // The Present button (docs/specs/012-collaboration/presentation-mode.md "The header's Present button"): passed
  // only while there is something to present, so absent means no button.
  present?: { slideCount: number; starting: boolean; onPresent: () => void };
  // An editor's own action in Share's place, shown whether or not Share would be (liveplanner's Share Form while a
  // form tab is open). The visibility pill still opens Share.
  shareAction?: ReactNode;
  // The account control at the far right (the editor's AuthControls: Sign in, or the account menu).
  account: ReactNode;
};

// The editor's header (docs/specs/007-editor/editor-app.md "Header actions"; `live-app.md` in livedesign): the logo,
// the item's name with its visibility pill and role pill, and the right edge's full-height actions. One copy for
// every editor; each binds it in its components/chrome/EditorHeader.tsx with only what differs.
export function EditorHeader({
  app,
  logoHref,
  words,
  name,
  hideTitle = false,
  showShare,
  shareable,
  team = false,
  offline = false,
  community = false,
  onMakeCopy,
  copying = false,
  readOnly = false,
  onOpenShare,
  onRename,
  renameNonce = 0,
  rolePill,
  present,
  shareAction,
  account,
}: EditorHeaderProps) {
  const [editing, setEditing] = useState(false);

  // The command palette requests a rename by bumping renameNonce. Each request is honoured once, as soon as the
  // title can be edited (it may be hidden behind the welcome modal when it arrives); the mount value is never a
  // request.
  const [handledNonce, setHandledNonce] = useState(renameNonce);
  if (renameNonce !== handledNonce && !readOnly && !hideTitle) {
    setHandledNonce(renameNonce);
    setEditing(true);
  }

  return (
    // `relative z-[var(--z-modal)]` puts the entire header into its own stacking context above the canvas sibling
    // that follows it. Without it, the account control's absolute-positioned menu (which overflows the header bounds
    // downward) was hidden behind the canvas: siblings without explicit z-index stack in document order and the
    // canvas wins.
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
        {/* The editor's logo goes up one level, to the Explorer; the Explorer's goes to the homepage. A plain logo,
            with no site switcher: in an editor it stays out of the way of the work
            (liveworkspace/docs/specs/010-site/site-switcher.md "Where it shows"). */}
        <Brand
          app={app}
          href={logoHref}
          size="md"
          wordmarkClassName="hidden sm:inline"
          className="relative touch-target"
        />
      </div>
      {/* min-w-0 down to the name, so a long name truncates instead of pushing Share and Sign in off a phone. */}
      <div className="flex min-w-0 flex-1 items-center justify-start sm:justify-center">
        {hideTitle ? null : editing && !readOnly ? (
          <NameEditor
            label={words.nameLabel}
            initial={name}
            onCommit={(v) => {
              onRename(v.trim() || name);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        ) : (
          <div className="flex min-w-0 items-center gap-1">
            {readOnly ? (
              <span className="truncate px-2 py-0.5 text-sm text-slate-600 dark:text-slate-200">
                {name}
              </span>
            ) : (
              <HoverCard
                title={words.renameTitle}
                description="Click to edit the name."
                className="min-w-0"
              >
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  // 44px tall on a touch screen; padding, not a pad, since `truncate` clips a ::before.
                  className="truncate rounded px-2 py-0.5 text-sm text-slate-600 transition pointer-coarse:py-3 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {name}
                </button>
              </HoverCard>
            )}
            {/* The pills never shrink: the name truncates first, so a pill never runs into the next one. */}
            <span data-header-pills className="hidden shrink-0 items-center gap-1 sm:flex">
              <SharedBadge
                shareable={shareable}
                team={team}
                offline={offline}
                community={community}
                onManage={showShare ? onOpenShare : undefined}
              />
              {rolePill ? <span className="ml-1 inline-flex">{rolePill}</span> : null}
            </span>
          </div>
        )}
      </div>
      {/* Right-edge actions: full-height, flush to the top / bottom / right of the bar (the -mr-4 cancels the
          header's right padding). */}
      <div className="-mr-4 flex shrink-0 items-stretch self-stretch">
        {onMakeCopy ? (
          <HoverCard title="Make a Copy" description={words.copyDescription}>
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
        {present ? <PresentButton {...present} lead={words.presentLead ?? 'Present'} /> : null}
        {shareAction ??
          (showShare ? (
            <HoverCard
              title={shareable ? 'Shared' : 'Share'}
              description={
                shareable ? 'Click to manage links.' : 'Invite collaborators with a link.'
              }
            >
              <button
                type="button"
                data-tour-id="share"
                onClick={onOpenShare}
                className={`${HEADER_ACTION_BTN} ${headerActionTone(shareable)}`}
                aria-pressed={shareable}
              >
                <HeaderGlyph>
                  <HeaderShareIcon />
                </HeaderGlyph>
                {/* Label stays "Share" in both states: the verb never changes to "Shared". State is communicated by
                  the brand fill, the aria-pressed flip and the SharedBadge by the title. */}
                <span>Share</span>
              </button>
            </HoverCard>
          ) : null)}
        {/* The product's surfaces live in the Explorer panel's footer
            (docs/specs/013-workspace/explorer-structure.md "Layout"), so the header keeps just its primary actions. */}
        {account}
      </div>
    </header>
  );
}

/** A header action's tone while it is on (Share while shared, liveplanner's Share Form while published) or off. */
export function headerActionTone(on: boolean): string {
  return on
    ? `bg-brand-700 text-white hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`
    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800';
}

function PresentButton({
  slideCount,
  starting,
  onPresent,
  lead,
}: NonNullable<EditorHeaderProps['present']> & { lead: string }) {
  return (
    <HoverCard
      title="Present"
      description={`${lead}: ${slideCount} ${slideCount === 1 ? 'slide' : 'slides'}.`}
    >
      <button
        type="button"
        onClick={onPresent}
        disabled={starting}
        data-presentation-start="header"
        className={`${HEADER_ACTION_BTN} text-slate-600 enabled:hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:text-slate-200 dark:enabled:hover:bg-slate-800`}
      >
        <HeaderGlyph>
          <PresentIcon />
        </HeaderGlyph>
        <span>{starting ? 'Starting' : 'Present'}</span>
      </button>
    </HoverCard>
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

/** Share's glyph, also liveplanner's Share Form. */
export function HeaderShareIcon() {
  return (
    <Glyph size={13} units={16}>
      <circle cx="4" cy="8" r="1.6" />
      <circle cx="12" cy="3.5" r="1.6" />
      <circle cx="12" cy="12.5" r="1.6" />
      <path d="M5.4 7.2l5.2-3M5.4 8.8l5.2 3" />
    </Glyph>
  );
}
