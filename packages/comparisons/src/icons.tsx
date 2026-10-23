import type { ReactNode } from 'react';

// The comparison pages' glyphs: lucide's shapes on its 24-unit grid, drawn here so the package needs
// no app's icon package. Each is decorative and square, in the parent's text colour, with a stroke of
// about 1.5 on-screen px whatever its size.

export type Icon = (props: { size?: number; className?: string }) => ReactNode;

function lucide(children: ReactNode): Icon {
  return function LucideIcon({ size = 16, className }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth={(24 / size) * 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    );
  };
}

// The pages' own chrome.
export const CheckIcon = lucide(<path d="M20 6 9 17l-5-5" />);
export const DotIcon = lucide(
  <>
    <circle cx={12} cy={12} r={1} />
    <circle cx={12} cy={12} r={10} />
  </>,
);
export const ArrowRightIcon = lucide(
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>,
);
export const ChevronDownIcon = lucide(<path d="m6 9 6 6 6-6" />);

// What each kind of competitor is (looks.ts), never its logo.
export const HighlighterIcon = lucide(
  <>
    <path d="m9 11-6 6v3h9l3-3" />
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
  </>,
);
export const StickyNoteIcon = lucide(
  <>
    <path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />
    <path d="M15 3v5a1 1 0 0 0 1 1h5" />
  </>,
);
export const ListTreeIcon = lucide(
  <>
    <path d="M8 5h13" />
    <path d="M13 12h8" />
    <path d="M13 19h8" />
    <path d="M3 10a2 2 0 0 0 2 2h3" />
    <path d="M3 5v12a2 2 0 0 0 2 2h3" />
  </>,
);
export const PencilIcon = lucide(
  <>
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    <path d="m15 5 4 4" />
  </>,
);
export const WorkflowIcon = lucide(
  <>
    <rect x={3} y={3} width={8} height={8} rx={2} />
    <path d="M7 11v4a2 2 0 0 0 2 2h4" />
    <rect x={13} y={13} width={8} height={8} rx={2} />
  </>,
);
export const ShapesIcon = lucide(
  <>
    <path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" />
    <rect x={3} y={14} width={7} height={7} rx={1} />
    <circle cx={17.5} cy={17.5} r={3.5} />
  </>,
);
export const NetworkIcon = lucide(
  <>
    <rect x={16} y={16} width={6} height={6} rx={1} />
    <rect x={2} y={16} width={6} height={6} rx={1} />
    <rect x={9} y={2} width={6} height={6} rx={1} />
    <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
    <path d="M12 12V8" />
  </>,
);
export const SquareKanbanIcon = lucide(
  <>
    <rect x={3} y={3} width={18} height={18} rx={2} />
    <path d="M8 7v7" />
    <path d="M12 7v4" />
    <path d="M16 7v9" />
  </>,
);
export const ListChecksIcon = lucide(
  <>
    <path d="M13 5h8" />
    <path d="M13 12h8" />
    <path d="M13 19h8" />
    <path d="m3 17 2 2 4-4" />
    <path d="m3 7 2 2 4-4" />
  </>,
);
export const LayoutGridIcon = lucide(
  <>
    <rect x={3} y={3} width={7} height={7} rx={1} />
    <rect x={14} y={3} width={7} height={7} rx={1} />
    <rect x={14} y={14} width={7} height={7} rx={1} />
    <rect x={3} y={14} width={7} height={7} rx={1} />
  </>,
);
export const BookOpenIcon = lucide(
  <>
    <path d="M12 5v16" />
    <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
  </>,
);
export const ListTodoIcon = lucide(
  <>
    <path d="M13 5h8" />
    <path d="M13 12h8" />
    <path d="M13 19h8" />
    <path d="m3 17 2 2 4-4" />
    <rect x={3} y={4} width={6} height={6} rx={1} />
  </>,
);
export const CircleCheckIcon = lucide(
  <>
    <circle cx={12} cy={12} r={10} />
    <path d="m16 9-5.5 5.5L8 12" />
  </>,
);
export const DatabaseIcon = lucide(
  <>
    <ellipse cx={12} cy={5} rx={9} ry={3} />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </>,
);
export const TableIcon = lucide(
  <>
    <path d="M12 3v18" />
    <rect x={3} y={3} width={18} height={18} rx={2} />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
  </>,
);
export const AppWindowIcon = lucide(
  <>
    <rect x={2} y={4} width={20} height={16} rx={2} />
    <path d="M10 4v4" />
    <path d="M2 8h20" />
    <path d="M6 4v4" />
  </>,
);
export const PenToolIcon = lucide(
  <>
    <path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z" />
    <path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18" />
    <path d="m2.3 2.3 7.286 7.286" />
    <circle cx={11} cy={11} r={2} />
  </>,
);
