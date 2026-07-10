// Icon set for the floating Explorer panel. Lifted out of
// Explorer.tsx so the surface stays scannable: the file is now
// the data + behaviour, the icons are the chrome glyphs. Same
// pattern as apps/live/app/explorer/icons.tsx for the standalone
// Explorer page.
//
// Co-located on purpose. The two icon sets (this one + the
// standalone-page set) overlap in concept but their SVG paths /
// dimensions diverge in ways that would defeat a shared library
// today, so a merger waits until a real third caller forces it.

export function SharedDiagramIcon() {
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
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11" />
      <path d="M10 9.5l2 2-2 2" />
      <path d="M12 11.5h-4" />
    </svg>
  );
}

export function RemoveIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3.5 3.5l7 7M3.5 10.5l7-7" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
      aria-hidden
    >
      <path d="M3 1.5L6 4.5L3 7.5" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.5 4h3l1 1h6.5v5.5h-10.5z" />
      <path d="M3.5 4V3h3" />
    </svg>
  );
}

export function UnsortedIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 3.5h10v7h-10z" strokeDasharray="2 2" />
    </svg>
  );
}

// Folder with a lightning mark for the panel's "Dynamic" group: the parent
// of the synthetic Unsorted / Offline nodes (live views, not real folders).
export function DynamicFolderIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.75 4A1.25 1.25 0 0 1 3 2.75h2.4a1 1 0 0 1 .77.37l.6.73a1 1 0 0 0 .77.37H11A1.25 1.25 0 0 1 12.25 5.5v4.5A1.25 1.25 0 0 1 11 11.25H3A1.25 1.25 0 0 1 1.75 10V4z" />
      <path d="M7.4 5.4 6.1 7.4h1.5L6.3 9.3" />
    </svg>
  );
}

// Cloud-with-slash for the panel's synthetic Offline node (spec/76).
export function OfflineFolderIcon() {
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
      <path d="M4.5 12h6.6a2.4 2.4 0 0 0 .4-4.77 3.4 3.4 0 0 0-6.3-.8A2.3 2.3 0 0 0 4.5 12Z" />
      <path d="M2.8 2.8l10.4 10.4" />
    </svg>
  );
}

export function PencilIcon() {
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

// `size` + `strokeWidth` props let every "delete a row" surface
// share the same SVG paths. Defaults (13 / 1.5) match the
// Explorer's original local copy and the now-shared TabBar +
// ShareDialog import, so existing callers stay byte-identical.
// Other callers (ActivityPanel 12/1.5, MultiSelectionToolbar
// 14/1.5, GalleryPane + ImagePicker 13/1.6, SelectionPopover
// 16/1.75) override per their layout context.
export function TrashIcon({
  size = 13,
  strokeWidth = 1.5,
}: { size?: number; strokeWidth?: number } = {}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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

export function DuplicateIcon() {
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
      <rect x="5" y="5" width="8" height="8" rx="1.25" />
      <path d="M3 11V4a1 1 0 0 1 1-1h7" />
    </svg>
  );
}

export function OpenIcon() {
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
      <path d="M9.5 2.5h4v4" />
      <path d="M13 3L7.5 8.5" />
      <path d="M12.5 9.5v3a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 2v8M2 6h8" />
    </svg>
  );
}
