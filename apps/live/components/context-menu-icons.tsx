// 12 px stroke-currentColor icons used exclusively by the editor's
// right-click context menu (element and canvas modes). They lived
// inline at the bottom of editor-page.tsx; pulled out here so the
// page file stays focused on orchestration rather than the SVG
// vocabulary. No behaviour change.
//
// All icons share the same visual contract: 12x12, 16-unit viewBox,
// stroke="currentColor", `aria-hidden`. The matching MenuItem in
// PortalMenu sets the colour via Tailwind's text-* utilities so
// each icon picks up the surrounding row's tone (default / danger
// / disabled) without needing per-icon variants.

export function LayerUpIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="6" y="6" width="7" height="7" rx="1" fill="white" />
    </svg>
  );
}

export function LayerDownIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="6" y="6" width="7" height="7" rx="1" />
      <rect x="3" y="3" width="7" height="7" rx="1" fill="white" />
    </svg>
  );
}

export function NoteMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 2.5h7l3 3v8a0.5 0.5 0 0 1 -0.5 0.5h-9.5a0.5 0.5 0 0 1 -0.5 -0.5v-10.5a0.5 0.5 0 0 1 0.5 -0.5z" />
      <path d="M10 2.5v3h3" />
      <path d="M5.5 9h5M5.5 11.5h5" />
    </svg>
  );
}

export function CommentMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
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

export function LinkMenuIcon() {
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
      <path d="M7 4.5l1.5-1.5a3.25 3.25 0 0 1 4.6 4.6L11 9.5" />
      <path d="M9 11.5l-1.5 1.5a3.25 3.25 0 0 1-4.6-4.6L5 7" />
      <line x1="6" y1="10" x2="10" y2="6" />
    </svg>
  );
}

export function SquareMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
    </svg>
  );
}

export function CircleMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <circle cx="8" cy="8" r="5" />
    </svg>
  );
}

export function StickyMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3h10v7l-3 3H3z" />
      <path d="M13 10h-3v3" />
    </svg>
  );
}

export function PencilMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11.5 2.5 13.5 4.5 5.5 12.5 3 13 3.5 10.5z" />
      <path d="M10 4 12 6" />
    </svg>
  );
}

export function AnnotationMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3h10v7H7l-3 3v-3H3z" />
    </svg>
  );
}

export function PaletteMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2a6 6 0 1 0 0 12 1.2 1.2 0 0 0 0-2.4 1.2 1.2 0 0 1 0-2.4h1.4A3.4 3.4 0 0 0 12.8 5.8 4 4 0 0 0 8 2z" />
      <circle cx="5" cy="6.5" r="0.6" fill="currentColor" />
      <circle cx="8" cy="5" r="0.6" fill="currentColor" />
      <circle cx="11" cy="7" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function CanvasMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <circle cx="6" cy="6" r="0.6" fill="currentColor" />
      <circle cx="10" cy="6" r="0.6" fill="currentColor" />
      <circle cx="6" cy="10" r="0.6" fill="currentColor" />
      <circle cx="10" cy="10" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function AutoAlignIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4h12M2 8h12M2 12h12" />
    </svg>
  );
}
