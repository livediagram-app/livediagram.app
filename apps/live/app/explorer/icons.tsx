// Icon set for the standalone /explorer page. Lifted out of
// page.tsx so the surface stays scannable: the page is now the
// data + layout, the icons are the chrome glyphs. No props or
// state beyond size / a binary open flag where the icon morphs
// (chevron, folder), so they're trivially shareable.
//
// Co-located with the page on purpose. /explorer is the only
// consumer today; promoting these to a cross-app icon library
// before that's needed would invent surface area for no caller.

export function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3.5 3.5l7 7M3.5 10.5l7-7" />
    </svg>
  );
}

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }}
    >
      <path d="M3 2l4 3-4 3" />
    </svg>
  );
}

export function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      {open ? (
        <path d="M1.5 4.5a1.5 1.5 0 0 1 1.5-1.5h3.4a1 1 0 0 1 .77.37l1 1.24a1 1 0 0 0 .78.39h4.05A1.5 1.5 0 0 1 14.5 6.5H1.5v-2zm0 3h13l-.93 4.65a1.5 1.5 0 0 1-1.47 1.2H3.9a1.5 1.5 0 0 1-1.47-1.2L1.5 7.5z" />
      ) : (
        <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3.4a1 1 0 0 1 .77.37l1 1.24a1 1 0 0 0 .78.39H13a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-7z" />
      )}
    </svg>
  );
}

export function DiagramIcon() {
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
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 6h6M5 9h4" />
    </svg>
  );
}

export function ClockIcon() {
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
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2 1.5" />
    </svg>
  );
}

export function ShareIcon() {
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
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M5.8 7l4.4-2.2M5.8 9l4.4 2.2" />
    </svg>
  );
}

export function ImageIcon() {
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
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="6" cy="7" r="1.2" />
      <path d="M2.5 12l3-3 2.5 2.5L11 8l3 3" />
    </svg>
  );
}

// Painter's palette: the Themes section (spec/44).
export function PaletteIcon() {
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
      <path d="M8 2a6 6 0 0 0 0 12c1 0 1.4-.7 1.4-1.3 0-.7-.6-1-.6-1.7 0-.5.4-.9 1-.9H11A3 3 0 0 0 14 7c0-2.8-2.7-5-6-5z" />
      <circle cx="5.5" cy="7" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="8" cy="5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function KeyIcon() {
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
      <circle cx="5.5" cy="5.5" r="3" />
      <path d="M7.7 7.7 13.5 13.5" />
      <path d="M11 11l1.2-1.2M12.3 12.3l1.2-1.2" />
    </svg>
  );
}

export function TeamIcon() {
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
      <circle cx="5.5" cy="6" r="2.2" />
      <path d="M1.8 13.2c.5-2.1 1.9-3.2 3.7-3.2s3.2 1.1 3.7 3.2" />
      <circle cx="11.5" cy="5" r="1.8" />
      <path d="M10.4 9.3c.35-.1.72-.15 1.1-.15 1.6 0 2.8 1 3.2 2.85" />
    </svg>
  );
}

export function InviteIcon() {
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
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 4.5L8 9l5.5-4.5" />
    </svg>
  );
}

export function EllipsisIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle cx="3" cy="7" r="1.25" fill="currentColor" />
      <circle cx="7" cy="7" r="1.25" fill="currentColor" />
      <circle cx="11" cy="7" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function MenuPencilIcon() {
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
    >
      <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11z" />
    </svg>
  );
}

export function MenuDuplicateIcon() {
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
    >
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M2 11V3.5A1.5 1.5 0 0 1 3.5 2H10" />
    </svg>
  );
}

export function MenuFolderIcon() {
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
    >
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4a1 1 0 0 1 .77.37l1 1.24A1 1 0 0 0 8.45 5h4.05A1.5 1.5 0 0 1 14 6.5v5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7z" />
    </svg>
  );
}

export function MenuTrashIcon() {
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
    >
      <path d="M3 4h10M6 4V2.5h4V4M4.5 4l.6 9.2A1 1 0 0 0 6.1 14h3.8a1 1 0 0 0 1-0.8l.6-9.2" />
    </svg>
  );
}
