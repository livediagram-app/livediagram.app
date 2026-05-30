import { useEffect, useRef, useState } from 'react';
import { Brand } from '@livediagram/ui';

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
  brandAccent,
  onOpenShare,
  onRename,
}: EditorHeaderProps) {
  const [editing, setEditing] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
      <div className="flex w-48 items-center">
        <Brand href="/" size="md" accentColor={brandAccent} />
      </div>
      <div className="flex flex-1 items-center justify-center">
        {hideTitle ? null : editing ? (
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
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="truncate rounded px-2 py-0.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              title="Click to rename"
            >
              {diagramName}
            </button>
            <SharedBadge shareable={shareable} />
          </div>
        )}
      </div>
      <div className="flex w-56 items-center justify-end gap-2">
        {showShare ? (
          <button
            type="button"
            onClick={onOpenShare}
            className={
              shareable
                ? 'inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600'
                : 'inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50'
            }
            aria-pressed={shareable}
            title={shareable ? 'Shared — click to manage' : 'Share this diagram'}
          >
            <ShareIcon />
            {shareable ? 'Shared' : 'Share'}
          </button>
        ) : null}
      </div>
    </header>
  );
}

// Small pill rendered to the right of the diagram-name ellipsis menu
// so the owner can see at a glance whether the diagram is private or
// shared. Hover surfaces the same description that lives on the
// Share button. Hidden on visitor views where the share UI doesn't
// apply.
function SharedBadge({ shareable }: { shareable: boolean }) {
  return (
    <span
      title={
        shareable
          ? 'This diagram is shared — anyone with a link in the Share dialog can access it.'
          : 'This diagram is private to you. Open the Share dialog to invite collaborators.'
      }
      className={
        shareable
          ? 'inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200'
          : 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 ring-1 ring-slate-200'
      }
    >
      <span aria-hidden className={shareable ? 'text-brand-500' : 'text-slate-400'}>
        {shareable ? <SharedDotIcon /> : <PrivateDotIcon />}
      </span>
      {shareable ? 'Shared' : 'Private'}
    </span>
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
      className="rounded border border-slate-300 px-2 py-0.5 text-sm text-slate-800 outline-none focus:border-brand-500"
    />
  );
}

function PencilIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11.5 2.5l2 2-8 8H3.5v-2z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
    </svg>
  );
}
