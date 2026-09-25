// The hero illustration's glyph vocabulary: the small, stateless pieces the
// five editor windows draw themselves out of. Split from HeroIllustration,
// which was over the 1000-line mark and mixed a timed animation with 370
// lines of SVG paths. Every one of these is pure markup with no state, no
// module constants and no reference to another, so they read on their own.

// A tab's presence avatar, sized as the editor's TabPresenceStack sizes them:
// small initials on the participant's colour, a white ring, overlapping the
// next one by a hair (the last carries no overlap so the stack sits inside
// the pill's padding).
export function TabAvatar({
  initials,
  color,
  last,
}: {
  initials: string;
  color: string;
  last: boolean;
}) {
  return (
    <span
      style={{ backgroundColor: color }}
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white text-[7px] font-semibold text-white ${
        last ? '' : '-mr-0.5'
      }`}
    >
      {initials}
    </span>
  );
}

// Tab-bar "Tabs" label icon, mirroring apps/live/components/TabBar.tsx.
export function TabsLabelIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.5 4.5h3l1 1.25h5v4.25h-9z" />
      <path d="M3 4.5V3h3.25" />
    </svg>
  );
}

// Connected-nodes glyph for the header "Shared" badge, mirroring
// EditorHeader's SharedDotIcon.
export function SharedDotIcon() {
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

// Padlock glyph for the header "Private" badge, mirroring EditorHeader's
// PrivateDotIcon.
export function PrivateDotIcon() {
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

// Small chrome glyphs: the bottom tab bar's toolbelt (search, keyboard
// shortcuts, settings, dark-mode) and the zoom cluster (history, undo, redo,
// layers, brush). Decorative, sized for the chrome.
export function ToolGlyph({
  kind,
  small = false,
}: {
  kind: 'search' | 'keys' | 'sliders' | 'moon' | 'history' | 'undo' | 'redo' | 'layers' | 'brush';
  // The editor's bottom chrome draws its glyphs small inside roomy hit
  // targets; `small` is that proportion.
  small?: boolean;
}) {
  const px = small ? 11 : 15;
  const common = {
    width: px,
    height: px,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  } as const;
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-md">
      {kind === 'search' ? (
        <svg {...common}>
          <circle cx="7" cy="7" r="4" />
          <path d="M10 10l3.5 3.5" />
        </svg>
      ) : kind === 'keys' ? (
        <svg {...common}>
          <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
          <path d="M4 7h.01M7 7h.01M10 7h.01M5 9.5h6" />
        </svg>
      ) : kind === 'sliders' ? (
        <svg {...common}>
          <path d="M2 5h12M2 11h12" />
          <circle cx="6" cy="5" r="1.6" fill="white" />
          <circle cx="10.5" cy="11" r="1.6" fill="white" />
        </svg>
      ) : kind === 'history' ? (
        <svg {...common}>
          <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" />
          <path d="M2.5 3v3h3M8 5.5V8l2 1.5" />
        </svg>
      ) : kind === 'undo' ? (
        <svg {...common}>
          <path d="M6 4 3 7l3 3" />
          <path d="M3 7h6.5a3.5 3.5 0 0 1 0 7H7" />
        </svg>
      ) : kind === 'redo' ? (
        <svg {...common}>
          <path d="M10 4l3 3-3 3" />
          <path d="M13 7H6.5a3.5 3.5 0 0 0 0 7H9" />
        </svg>
      ) : kind === 'layers' ? (
        <svg {...common}>
          <path d="M8 2.5 14 5.5 8 8.5 2 5.5z" strokeLinejoin="round" />
          <path d="M2 8.5l6 3 6-3M2 11.5l6 3 6-3" />
        </svg>
      ) : kind === 'brush' ? (
        <svg {...common}>
          <path d="M13.5 2.5 7 9l-1 1 .5 .5 1-1 6.5-6.5z" strokeLinejoin="round" />
          <path d="M6 10c-1.5 0-2.5 1-2.5 2.5S2 14 2 14s2 .2 3.5-1S6 10 6 10z" />
        </svg>
      ) : (
        <svg {...common}>
          <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" />
        </svg>
      )}
    </span>
  );
}

export function Shape({ kind }: { kind: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    'aria-hidden': true,
  } as const;
  switch (kind) {
    case 'rect':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="10" height="10" rx="2" />
        </svg>
      );
    case 'circle':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...common}>
          <polygon points="8,3 13,8 8,13 3,8" strokeLinejoin="round" />
        </svg>
      );
    case 'cyl':
      return (
        <svg {...common}>
          <path d="M3 5 L3 12 A5 1.5 0 0 0 13 12 L13 5" strokeLinejoin="round" />
          <ellipse cx="8" cy="5" rx="5" ry="1.5" />
        </svg>
      );
    case 'para':
      return (
        <svg {...common}>
          <polygon points="4,3 13,3 12,13 3,13" strokeLinejoin="round" />
        </svg>
      );
    case 'hex':
      return (
        <svg {...common}>
          <polygon points="4,3 11,3 14,8 11,13 4,13 1,8" strokeLinejoin="round" />
        </svg>
      );
    case 'doc':
      return (
        <svg {...common}>
          <path
            d="M3 3 L13 3 L13 12 C11 13.4 9.5 11.5 8 12.6 C6.5 13.7 5 11.5 3 12.6 Z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'pill':
      return (
        <svg {...common}>
          <rect x="2" y="5" width="12" height="6" rx="3" />
        </svg>
      );
    case 'text':
      return (
        <svg {...common} strokeLinecap="round">
          <path d="M3.5 4h9M8 4v9M6 13h4" />
        </svg>
      );
    case 'arrow':
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8h9M9 4.5 12.5 8 9 11.5" />
        </svg>
      );
    case 'frame':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M3 5.5V13h10V5.5M3 5.5V3h4l1 2.5h5" />
        </svg>
      );
    case 'note':
      return (
        <svg {...common} strokeLinejoin="round">
          <path d="M3 3h10v6l-4 4H3z" />
          <path d="M9 13V9h4" />
        </svg>
      );
    case 'image':
      return (
        <svg {...common} strokeLinejoin="round">
          <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
          <path d="M2.5 11l3.5-3.5 3 3 2-2 2.5 2.5" />
          <circle cx="10.5" cy="6" r="1" />
        </svg>
      );
    case 'pen':
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 13c1-4 3-6 6-8l2 2c-2 3-4 5-8 6z" />
          <path d="M9 5l2 2" />
        </svg>
      );
  }
  return null;
}

// The presenting HUD's previous / next arrows.
export function HudChevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === 'prev' ? <path d="M7.5 2.5 4 6l3.5 3.5" /> : <path d="M4.5 2.5 8 6l-3.5 3.5" />}
    </svg>
  );
}

export function MenuGlyph() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 3h8M2 6h8M2 9h8" />
    </svg>
  );
}

export function ChevronGlyph() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 4.5l3 3 3-3" />
    </svg>
  );
}

export function StarGlyph() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 1.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1L6 8.6 3.2 10.1l.6-3.1L1.5 4.8l3.1-.4z" />
    </svg>
  );
}

export function ShareGlyph() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 7.5V1.5M3.5 4 6 1.5 8.5 4" />
      <path d="M2.5 6.5v3.5h7V6.5" />
    </svg>
  );
}

export function EyeGlyph({ off }: { off: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
      {off ? <path d="M2.5 13.5l11-11" /> : null}
    </svg>
  );
}
