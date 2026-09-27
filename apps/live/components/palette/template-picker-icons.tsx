import { Glyph } from '@livediagram/ui';
// Inline SVG icons for the template picker (create-diagram CTA,
// folder-open, spinner, sparkle, pencil). Pure presentational; split out
// of TemplatePicker.tsx.
export function ArrowRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FolderOpenIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.3l1.2 1.5h5.5A1.5 1.5 0 0 1 14 6" />
      <path d="M2 6h11.2a1 1 0 0 1 .97 1.24l-1 4A1 1 0 0 1 12.2 12H3.3a1 1 0 0 1-.98-.8L1.3 6.2A1 1 0 0 1 2.28 5H2z" />
    </Glyph>
  );
}

// Inline spinner for the Create Diagram button while the host commits.
export function Spinner() {
  return (
    <Glyph size={13} units={16} className="animate-spin" strokeLinejoin="miter">
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" />
    </Glyph>
  );
}

// Pencil for the step rail's "Just Draw" shortcut (docs/specs/007-editor/new-diagram-route.md).
export function PencilIcon() {
  return (
    <Glyph size={13} units={16}>
      <path d="m11.1 2.6 2.3 2.3-7.8 7.8-3 .7.7-3z" />
      <path d="m9.6 4.1 2.3 2.3" />
    </Glyph>
  );
}

export function SparkleIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M8 2.5l1.4 3.1L12.5 7l-3.1 1.4L8 11.5 6.6 8.4 3.5 7l3.1-1.4z" />
      <path d="M12.5 11.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
    </Glyph>
  );
}
