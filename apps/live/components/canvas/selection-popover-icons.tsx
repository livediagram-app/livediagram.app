// 16px stroke-currentColor action icons used by the floating SelectionPopover
// toolbar that are specific to it (edit text, bring to front / send to back).
// The duplicate / lock / comment / delete glyphs it shares with the other
// toolbars come from @livediagram/ui.
// They lived inline at the bottom of SelectionPopover.tsx; pulled out here so
// that file stays focused on the toolbar's positioning + flip logic rather than
// its SVG vocabulary, mirroring the other per-area icon modules
// (context-menu-icons / table-icons / tab-bar-icons). No behaviour change.
// Colour comes from the parent via `currentColor`.

// The 16px overflow ellipsis, shared with the rich-text toolbar (the
// same more-actions motif on the two floating canvas toolbars).
export { EllipsisIcon } from '@/components/rich-text/rich-text-toolbar-icons';

// "Edit text" button — a serif capital T, the universal text glyph (matches
// the palette's Add-text tile). Shown on the toolbar only when the selected
// element already has a label to edit.
export function TextIcon() {
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
      <path d="M3.5 4.5h9" />
      <path d="M8 4.5v7" />
      <path d="M6 11.5h4" />
    </svg>
  );
}

// Intra-layer z-order: a filled card lifted clear of a stacked one behind /
// in front of it, so the pair reads as "this one goes on top" and "this one
// goes underneath" without needing the label.
export function BringToFrontIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* The other card first (so it paints underneath), then the filled
          selection ON TOP and raised — front reads as both over and up. */}
      <rect x="9" y="9" width="11" height="11" rx="1.5" strokeDasharray="2.5 2.5" />
      <rect x="4" y="4" width="11" height="11" rx="1.5" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

export function SendToBackIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* The filled selection first (so it paints underneath) and dropped
          low — back reads as both behind and down. */}
      <rect x="9" y="9" width="11" height="11" rx="1.5" fill="currentColor" fillOpacity="0.2" />
      <rect x="4" y="4" width="11" height="11" rx="1.5" strokeDasharray="2.5 2.5" />
    </svg>
  );
}
