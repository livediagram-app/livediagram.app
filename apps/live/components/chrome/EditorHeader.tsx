import { PrivateDotIcon, SharedDotIcon } from '@/components/chrome/share-state-icons';
import { useEffect, useState } from 'react';
import { NameEditor } from '@/components/primitives/NameEditor';
import { Brand, ProductNav } from '@livediagram/ui';
import { AuthControls } from '@/components/chrome/AuthControls';
import { Tooltip } from '@/components/primitives/Tooltip';

// Sync state surfaced as a small pill next to the diagram title. The
// editor is autosave-driven, so silent failures (offline, API down,
// wrong env var pointing at unreachable host) used to look identical
// to a successful save. Now they don't.
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// Full-height, edge-flush header action button: the icon stacked over a small
// label, a left divider, hugging the top + bottom of the bar so the right-edge
// actions read as a row of tabs filling the header rather than little floating
// pills. Shared with AuthControls so Share / Make-a-copy / Sign-in all match.
// The caller adds the tone (default slate, or the Share brand fill).
export const HEADER_ACTION_BTN =
  'flex h-full min-w-[3.75rem] cursor-pointer flex-col items-center justify-center gap-1 border-l border-slate-200 px-3 text-[10px] font-medium leading-none transition dark:border-slate-800';

type EditorHeaderProps = {
  diagramName: string;
  // Hides the centred diagram title while the first-run welcome modal
  // is up (no diagram exists yet, naming it makes no sense). Brand and
  // Share button stay.
  hideTitle?: boolean;
  // Only the diagram's owner sees the Share button — visitors arriving
  // via a share URL can't toggle sharing on their host's diagram.
  showShare: boolean;
  shareable: boolean;
  // The diagram lives in a team's shared library (spec/35). Flips the
  // title badge to "Team" when the diagram has no share links.
  teamDiagram?: boolean;
  // Offline Mode (spec/76): saved only in this browser. Flips the title badge
  // to "Offline" (superseding "Private"); the caller also hides Share.
  offline?: boolean;
  // Counterpart to showShare for visitors: when present we render a
  // "Make a copy" button that duplicates the diagram into the
  // visitor's own files (item #9 / spec/11). Optional so the owner
  // view stays unchanged.
  onMakeCopy?: () => void;
  copying?: boolean;
  // True for a view-only ('view' share role) session. Disables the
  // click-to-rename affordance on the diagram title — the viewer
  // isn't allowed to rename someone else's diagram. Make-a-copy +
  // Share gates already handle their own visibility.
  readOnly?: boolean;
  // Accent colour for the brand logo's "diagram" half. Comes from the
  // active tab's theme stroke so the header subtly echoes the canvas.
  brandAccent?: string;
  onOpenShare: () => void;
  onRename: (name: string) => void;
  // Bumped by the command palette's "Rename diagram" action to enter inline
  // edit mode (the palette can't reach this component's local editing state).
  // A monotonic counter; each increment opens the editor (unless read-only).
  renameNonce?: number;
};

export function EditorHeader({
  diagramName,
  hideTitle = false,
  showShare,
  shareable,
  teamDiagram = false,
  offline = false,
  onMakeCopy,
  copying = false,
  readOnly = false,
  brandAccent,
  onOpenShare,
  onRename,
  renameNonce = 0,
}: EditorHeaderProps) {
  const [editing, setEditing] = useState(false);

  // The command palette requests a rename by bumping renameNonce. Skip the
  // initial 0 so we don't pop into edit mode on mount.
  useEffect(() => {
    if (renameNonce > 0 && !readOnly && !hideTitle) setEditing(true);
  }, [renameNonce, readOnly, hideTitle]);

  return (
    // `relative z-[var(--z-modal)]` puts the entire header into its own stacking
    // context above the canvas sibling that follows it. Without it,
    // AuthControls's absolute-positioned dropdown menu (which
    // overflows the header bounds downward) was getting hidden
    // behind the canvas — siblings without explicit z-index stack in
    // document order and the canvas wins.
    <header className="relative z-[var(--z-modal)] flex h-14 shrink-0 items-center justify-between gap-2 border-y border-slate-200 bg-white px-4 sm:gap-4 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex w-auto items-center gap-2.5">
        <Brand href="/" size="md" accentColor={brandAccent} wordmarkClassName="hidden sm:inline" />
        <ProductNav current="editor" />
      </div>
      <div className="flex flex-1 items-center justify-start sm:justify-center">
        {hideTitle ? null : editing && !readOnly ? (
          <NameEditor
            initial={diagramName}
            onCommit={(v) => {
              onRename(v.trim() || diagramName);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        ) : (
          <div className="flex items-center gap-1">
            {readOnly ? (
              <span className="truncate px-2 py-0.5 text-sm text-slate-600 dark:text-slate-200">
                {diagramName}
              </span>
            ) : (
              <Tooltip title="Rename diagram" description="Click to edit the name.">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="truncate rounded px-2 py-0.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {diagramName}
                </button>
              </Tooltip>
            )}
            <span className="hidden sm:contents">
              <SharedBadge shareable={shareable} team={teamDiagram} offline={offline} />
            </span>
          </div>
        )}
      </div>
      {/* Right-edge actions: full-height, flush to the top / bottom / right of
          the bar (the -mr-4 cancels the header's right padding). */}
      <div className="-mr-4 flex items-stretch self-stretch">
        {onMakeCopy ? (
          <Tooltip title="Make a copy" description="Duplicate this diagram into your own files.">
            <button
              type="button"
              onClick={onMakeCopy}
              disabled={copying}
              className={`${HEADER_ACTION_BTN} text-slate-600 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-brand-200`}
            >
              <CopyIcon />
              {copying ? 'Copying' : 'Copy'}
            </button>
          </Tooltip>
        ) : null}
        {showShare ? (
          <Tooltip
            title={shareable ? 'Shared' : 'Share'}
            description={shareable ? 'Click to manage links.' : 'Invite collaborators with a link.'}
          >
            <button
              type="button"
              onClick={onOpenShare}
              className={`${HEADER_ACTION_BTN} ${
                shareable
                  ? 'bg-brand-500 text-white hover:bg-brand-600'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
              aria-pressed={shareable}
            >
              <ShareIcon />
              {/* Label stays "Share" in both states — the user dislikes the
                  verb changing to "Shared". State is communicated by the
                  brand-500 fill + aria-pressed flip + the green SharedBadge by
                  the title. */}
              <span>Share</span>
            </button>
          </Tooltip>
        ) : null}
        {/* Explorer + Help used to sit here as top-right links; both now live
            in the ProductNav apps menu next to the logo, so the header keeps
            just its primary actions. */}
        <AuthControls />
      </div>
    </header>
  );
}

// Per-state pill styling for SharedBadge below, keyed by the resolved share
// state so the label / hover copy / badge + dot colours stay in one table
// rather than five parallel `state === ...` ternaries.
const SHARE_STATE_META: Record<
  'shared' | 'team' | 'private' | 'offline',
  { label: string; description: string; badge: string; dot: string }
> = {
  // Offline Mode (spec/76): saved only in this browser, never on the server.
  // Supersedes "Private" for an offline diagram. Amber so it reads as a
  // distinct, deliberate state rather than a neutral default.
  offline: {
    label: 'Offline',
    description: 'Saved only in this browser. Not synced, not backed up.',
    badge:
      'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
    dot: 'text-amber-500',
  },
  shared: {
    label: 'Shared',
    description: 'Anyone with a link can view.',
    badge:
      'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
    dot: 'text-emerald-500',
  },
  team: {
    label: 'Team',
    description: 'In a team library: every member of the team can open it.',
    badge:
      'inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30',
    dot: 'text-brand-500',
  },
  private: {
    label: 'Private',
    description: 'Only visible to you.',
    badge:
      'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
    dot: 'text-slate-400',
  },
};

// Small pill rendered to the right of the diagram name so the owner
// can see at a glance whether the diagram is private, shared, or in a
// team library (spec/35). Share links win: a shared team diagram
// reads "Shared" as normal; "Team" covers the team-but-unshared case
// where "Private" would be a lie (every joined member can open it).
// Hover surfaces the same description that lives on the Share
// button. Hidden on visitor views where the share UI doesn't apply.
function SharedBadge({
  shareable,
  team,
  offline,
}: {
  shareable: boolean;
  team?: boolean;
  offline?: boolean;
}) {
  const state: 'shared' | 'team' | 'private' | 'offline' = offline
    ? 'offline'
    : shareable
      ? 'shared'
      : team
        ? 'team'
        : 'private';
  const meta = SHARE_STATE_META[state];
  return (
    <Tooltip title={meta.label} description={meta.description}>
      <span className={meta.badge}>
        <span aria-hidden className={meta.dot}>
          {state === 'private' || state === 'offline' ? <PrivateDotIcon /> : <SharedDotIcon />}
        </span>
        {meta.label}
      </span>
    </Tooltip>
  );
}

function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="5" width="8" height="8.5" rx="1.5" />
      <path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H10" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="4" cy="8" r="1.6" />
      <circle cx="12" cy="3.5" r="1.6" />
      <circle cx="12" cy="12.5" r="1.6" />
      <path d="M5.4 7.2l5.2-3M5.4 8.8l5.2 3" />
    </svg>
  );
}
