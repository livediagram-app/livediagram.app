// The move-destination dialog's row + icon parts (spec/15 + /35),
// split out of MoveToFolderDialog: the indented DestinationRow with its
// expand chevron and "current" pill, and the folder / root / team
// glyphs the tree renders.

const INDENT_STEP = 16;

export function DestinationRow({
  icon,
  label,
  isCurrent,
  onClick,
  depth,
  hasChildren,
  open,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  isCurrent: boolean;
  onClick: () => void;
  depth: number;
  hasChildren: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-md ${
        isCurrent ? '' : 'hover:bg-brand-50 dark:hover:bg-brand-500/15'
      }`}
      style={{ paddingLeft: depth * INDENT_STEP + 4 }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Collapse' : 'Expand'}
        disabled={!hasChildren}
        className={`flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition ${
          hasChildren ? 'hover:text-slate-700 dark:hover:text-slate-200' : 'invisible'
        }`}
      >
        {hasChildren ? <ChevronIcon open={open} /> : null}
      </button>
      <button
        type="button"
        onClick={onClick}
        disabled={isCurrent}
        className={
          isCurrent
            ? 'flex min-w-0 flex-1 cursor-default items-center gap-2 py-1.5 text-left text-sm text-slate-400 dark:text-slate-400'
            : 'flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm text-slate-700 transition group-hover:text-brand-800 dark:text-slate-200 dark:group-hover:text-brand-100'
        }
      >
        <span className="shrink-0 text-slate-400 dark:text-slate-400" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {isCurrent ? (
          <span className="mr-2 shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            current
          </span>
        ) : null}
      </button>
    </div>
  );
}

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <path d="M2.5 4.5h4l1.5 1.5h5.5v6.5a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function RootIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M2.5 6h11" />
    </svg>
  );
}

export function TeamIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="6" cy="6" r="2.2" />
      <path d="M2.5 13c.5-2.3 1.7-3.5 3.5-3.5s3 1.2 3.5 3.5" />
      <circle cx="11.5" cy="6.5" r="1.8" />
      <path d="M11 9.6c1.6.1 2.6 1.2 3 3" />
    </svg>
  );
}
