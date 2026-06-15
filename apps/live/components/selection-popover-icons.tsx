// 16px stroke-currentColor action icons used by the floating SelectionPopover
// toolbar (the more/paint/duplicate/group/ungroup/lock/comment/delete buttons).
// They lived inline at the bottom of SelectionPopover.tsx; pulled out here so
// that file stays focused on the toolbar's positioning + flip logic rather than
// its SVG vocabulary, mirroring the other per-area icon modules
// (context-menu-icons / table-icons / tab-bar-icons). No behaviour change.
// Colour comes from the parent via `currentColor`.

export function EllipsisIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="4" cy="8" r="1.4" fill="currentColor" />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" />
      <circle cx="12" cy="8" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function PaintbrushIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13.5 2.5l-6 6" />
      <path d="M7 8l1.5 1.5" />
      <path d="M6.5 9.5a3 3 0 1 0 1 4.5c.5-.6.5-1.4 0-2-.6-.5-1.4-.5-2 0" />
    </svg>
  );
}

export function DuplicateIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" />
      <path d="M5.5 13.5h6a1.5 1.5 0 0 0 1.5-1.5v-6" />
    </svg>
  );
}

export function GroupIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.25" y="2.25" width="8" height="8" rx="1.25" />
      <rect x="5.75" y="5.75" width="8" height="8" rx="1.25" fill="white" />
    </svg>
  );
}

export function UngroupIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="6" height="6" rx="1" />
      <rect x="8" y="8" width="6" height="6" rx="1" />
    </svg>
  );
}

export function LockIcon({ closed }: { closed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="7.5" width="10" height="6.5" rx="1.25" />
      {closed ? (
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.5 0v2.5" />
      ) : (
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.4-.7" />
      )}
    </svg>
  );
}

export function CommentIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H7l-3 2.5V10.5A1.5 1.5 0 0 1 2.5 9z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
      <path d="M6.5 7v4M9.5 7v4" />
    </svg>
  );
}
