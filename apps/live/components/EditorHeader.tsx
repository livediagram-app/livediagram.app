import { useEffect, useRef, useState } from 'react';
import { Brand } from '@livediagram/ui';
import { AuthControls } from './AuthControls';
import { Tooltip } from './Tooltip';

// Sync state surfaced as a small pill next to the diagram title. The
// editor is autosave-driven, so silent failures (offline, API down,
// wrong env var pointing at unreachable host) used to look identical
// to a successful save. Now they don't.
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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
};

export function EditorHeader({
  diagramName,
  hideTitle = false,
  showShare,
  shareable,
  teamDiagram = false,
  onMakeCopy,
  copying = false,
  readOnly = false,
  brandAccent,
  onOpenShare,
  onRename,
}: EditorHeaderProps) {
  const [editing, setEditing] = useState(false);

  return (
    // `relative z-50` puts the entire header into its own stacking
    // context above the canvas sibling that follows it. Without it,
    // AuthControls's absolute-positioned dropdown menu (which
    // overflows the header bounds downward) was getting hidden
    // behind the canvas — siblings without explicit z-index stack in
    // document order and the canvas wins.
    <header className="relative z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 sm:gap-4 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex w-auto items-center sm:w-48">
        <Brand href="/" size="md" accentColor={brandAccent} wordmarkClassName="hidden sm:inline" />
      </div>
      <div className="flex flex-1 items-center justify-start sm:justify-center">
        {hideTitle ? null : editing && !readOnly ? (
          <NameEditor
            initial={diagramName}
            onCommit={(v) => {
              onRename(v);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
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
              <SharedBadge shareable={shareable} team={teamDiagram} />
            </span>
          </div>
        )}
      </div>
      <div className="flex w-56 items-center justify-end gap-2">
        {onMakeCopy ? (
          <Tooltip title="Make a copy" description="Duplicate this diagram into your own files.">
            <button
              type="button"
              onClick={onMakeCopy}
              disabled={copying}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition enabled:hover:border-brand-300 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-400 dark:enabled:hover:bg-slate-700 dark:enabled:hover:text-brand-200"
            >
              <CopyIcon />
              {copying ? 'Copying' : 'Make a copy'}
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
              className={
                shareable
                  ? 'inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600'
                  : 'inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }
              aria-pressed={shareable}
            >
              <ShareIcon />
              {/* Label stays "Share" in both states — the user dislikes
                  the verb changing to "Shared". State is communicated
                  by the brand-500 fill + aria-pressed flip; the small
                  green SharedBadge next to the diagram title in the
                  centre cluster is the explicit "on" affordance.
                  Hidden on mobile to keep the header dense; the icon
                  + brand-500 fill carry the state on small screens. */}
              <span className="hidden sm:inline">Share</span>
            </button>
          </Tooltip>
        ) : null}
        <AuthControls />
      </div>
    </header>
  );
}

// Small pill rendered to the right of the diagram name so the owner
// can see at a glance whether the diagram is private, shared, or in a
// team library (spec/35). Share links win: a shared team diagram
// reads "Shared" as normal; "Team" covers the team-but-unshared case
// where "Private" would be a lie (every joined member can open it).
// Hover surfaces the same description that lives on the Share
// button. Hidden on visitor views where the share UI doesn't apply.
function SharedBadge({ shareable, team }: { shareable: boolean; team?: boolean }) {
  const state: 'shared' | 'team' | 'private' = shareable ? 'shared' : team ? 'team' : 'private';
  return (
    <Tooltip
      title={state === 'shared' ? 'Shared' : state === 'team' ? 'Team' : 'Private'}
      description={
        state === 'shared'
          ? 'Anyone with a link can view.'
          : state === 'team'
            ? 'In a team library: every member of the team can open it.'
            : 'Only visible to you.'
      }
    >
      <span
        className={
          state === 'shared'
            ? 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'
            : state === 'team'
              ? 'inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30'
              : 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'
        }
      >
        <span
          aria-hidden
          className={
            state === 'shared'
              ? 'text-emerald-500'
              : state === 'team'
                ? 'text-brand-500'
                : 'text-slate-400'
          }
        >
          {state === 'private' ? <PrivateDotIcon /> : <SharedDotIcon />}
        </span>
        {state === 'shared' ? 'Shared' : state === 'team' ? 'Team' : 'Private'}
      </span>
    </Tooltip>
  );
}

function SharedDotIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="2" cy="4.5" r="1.4" />
      <circle cx="7" cy="2" r="1.2" />
      <circle cx="7" cy="7" r="1.2" />
      <path d="M3.2 3.8L5.9 2.5M3.2 5.2L5.9 6.5" />
    </svg>
  );
}

function PrivateDotIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="5" height="3.5" rx="0.8" />
      <path d="M3.25 4V3a1.25 1.25 0 0 1 2.5 0v1" />
    </svg>
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

function NameEditor({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (node) {
      node.focus();
      node.select();
    }
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value.trim() || initial)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(value.trim() || initial);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
    />
  );
}
