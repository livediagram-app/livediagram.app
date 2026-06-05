import type { ShapeKind } from '@livediagram/diagram';

// 14x14 mini glyphs for every ShapeKind, shown next to the shape
// kind picker in SelectedElementSection (and any other panel that
// wants the user-recognisable shape preview at icon scale). Pure
// outlines so the active-state background (from SizeButton) reads
// through.
//
// Distinct from ShapeSvgOverlay in shape-svg-overlay.tsx: that one
// paints the canvas-sized shape at any aspect ratio (it owns the
// device-frame + cylinder + cloud geometry the canvas renders);
// this is the small flat preview tile, hand-tuned for the 16x16
// viewBox so the diamond and cylinder still read at icon scale.
//
// Lifted out of palette-icons.tsx (which was 744 lines, two-thirds
// of it this single function) so the palette-icons file is scoped
// to glyphs that genuinely live in CommandPalette. ShapeIcon has
// always been the one outlier in that file (SelectedElementSection
// imports it, no palette consumer does), which the palette-icons
// preamble already flagged: "shared across panels => sibling icon
// module".

export function ShapeIcon({ kind }: { kind: ShapeKind }) {
  switch (kind) {
    case 'square':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="3" y="3" width="10" height="10" rx="1.5" />
        </svg>
      );
    case 'circle':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden
        >
          <polygon points="8,3 13,8 8,13 3,8" />
        </svg>
      );
    case 'cylinder':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 5 L3 12 A5 1.5 0 0 0 13 12 L13 5" />
          <ellipse cx="8" cy="5" rx="5" ry="1.5" />
        </svg>
      );
    case 'parallelogram':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden
        >
          <polygon points="4,3 13,3 12,13 3,13" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden
        >
          <polygon points="5,3 11,3 14,8 11,13 5,13 2,8" />
        </svg>
      );
    case 'document':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 3 L13 3 L13 12 C11 13.4 9.5 11.5 8 12.6 C6.5 13.7 5 11.5 3 12.6 Z" />
        </svg>
      );
    case 'stadium':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="2" y="5" width="12" height="6" rx="3" />
        </svg>
      );
    case 'actor':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="8" cy="3.4" r="2" />
          <path d="M8 5.4 L8 10" />
          <path d="M4.5 7.2 L11.5 7.2" />
          <path d="M8 10 L5.5 13.6" />
          <path d="M8 10 L10.5 13.6" />
        </svg>
      );
    case 'cloud':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12 C3 12 2 10.5 3.2 9.3 C2.3 8 3.7 6.6 5 7.2 C5.4 5.2 8.4 5 8.8 7.1 C10.6 6.3 12 8 10.9 9.3 C12 10.2 11.2 12 9.6 12 Z" />
        </svg>
      );
    case 'browser':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <path d="M2 6 L14 6" />
        </svg>
      );
    case 'monitor':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2" y="2.5" width="12" height="8" rx="1" />
          <path d="M5.5 13.5 L10.5 13.5" />
          <path d="M8 10.5 L8 13.5" />
        </svg>
      );
    case 'laptop':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="3" width="10" height="7" rx="0.8" />
          <path d="M1.5 12.5 L14.5 12.5 L13.5 10 L2.5 10 Z" />
        </svg>
      );
    case 'phone':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="5" y="1.5" width="6" height="13" rx="1.4" />
        </svg>
      );
    case 'tablet':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="2" width="10" height="12" rx="1" />
        </svg>
      );
  }
}
