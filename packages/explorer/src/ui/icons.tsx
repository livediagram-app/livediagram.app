// The Explorer's glyphs: liveplanner's explorer-icons set (its own 16-unit drawings, and the lucide shapes it
// borrows), drawn here so the package needs no app's icon package. Every glyph is a decorative, square SVG in
// the parent's text colour, with a stroke of about 1.5 on-screen px whatever its grid.

import type { CSSProperties, ReactNode } from 'react';

type GlyphProps = {
  size?: number;
  units?: number;
  filled?: boolean;
  fill?: string;
  className?: string;
  style?: CSSProperties;
  strokeLinejoin?: 'miter' | 'round';
  children: ReactNode;
};

export function Glyph({
  size = 16,
  units = 16,
  filled = false,
  fill,
  className,
  style,
  strokeLinejoin = 'round',
  children,
}: GlyphProps) {
  const paint = filled
    ? { fill: 'currentColor' }
    : {
        fill: fill ?? 'none',
        stroke: 'currentColor',
        strokeWidth: (units / size) * 1.5,
        strokeLinecap: 'round' as const,
        strokeLinejoin,
      };
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${units} ${units}`}
      aria-hidden
      className={className}
      style={style}
      {...paint}
    >
      {children}
    </svg>
  );
}

type IconProps = { size?: number; className?: string };

// A lucide drawing on its 24-unit grid.
export function lucide(children: ReactNode, defaultSize: number) {
  return function LucideIcon({ size = defaultSize, className }: IconProps) {
    return (
      <Glyph size={size} units={24} className={className}>
        {children}
      </Glyph>
    );
  };
}

const FOLDER_PATH =
  'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z';

// ---------- Tree + folders ----------

export function TreeChevronIcon({ open = false, size = 10 }: { open?: boolean; size?: number }) {
  return (
    <Glyph
      size={size}
      units={10}
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}
    >
      <path d="M3.5 2 6.5 5l-3 3" />
    </Glyph>
  );
}

// The page's filled folder, which opens when its subtree is expanded.
export function FolderSolidIcon({ open = false, size = 13 }: { open?: boolean; size?: number }) {
  return (
    <Glyph size={size} units={16} filled>
      {open ? (
        <path d="M1.5 4.5a1.5 1.5 0 0 1 1.5-1.5h3.4a1 1 0 0 1 .77.37l1 1.24a1 1 0 0 0 .78.39h4.05A1.5 1.5 0 0 1 14.5 6.5H1.5v-2zm0 3h13l-.93 4.65a1.5 1.5 0 0 1-1.47 1.2H3.9a1.5 1.5 0 0 1-1.47-1.2L1.5 7.5z" />
      ) : (
        <path d="M1.5 4.5A1.5 1.5 0 0 1 3 3h3.4a1 1 0 0 1 .77.37l1 1.24a1 1 0 0 0 .78.39H13a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5v-7z" />
      )}
    </Glyph>
  );
}

export const FolderOutlineIcon = lucide(<path d={FOLDER_PATH} />, 12);

// ---------- Sections ----------

export function ItemIcon({ size = 13 }: IconProps) {
  return (
    <Glyph size={size} units={16}>
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 6h6M5 9h4" />
    </Glyph>
  );
}

export function InboxIcon({ size = 13 }: IconProps) {
  return (
    <Glyph size={size} units={16}>
      <path d="M2 9V11.5a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 14 11.5V9" />
      <path d="M2 9h3.2l1 1.8h3.6l1-1.8H14" />
      <path d="M5.5 4.7 7.2 6.5l3.3-3.6" />
    </Glyph>
  );
}

// livediagram's Timeline mark: a rail with two events on it and their lines of text.
export function TimelineIcon({ size = 13 }: IconProps) {
  return (
    <Glyph size={size} units={16}>
      <path d="M4 2.5v11" />
      <circle cx="4" cy="5" r="1.1" />
      <circle cx="4" cy="11" r="1.1" />
      <path d="M6.5 5h6M6.5 11h4M6.5 8h2.8" />
    </Glyph>
  );
}

const CLOCK = (
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </>
);
export const ClockIcon = lucide(CLOCK, 13);
// The clock struck through: hidden from Recent.
export const ClockOffIcon = lucide(
  <>
    {CLOCK}
    <path d="m2 2 20 20" />
  </>,
  13,
);

export function StarIcon({ filled = false, size = 13 }: { filled?: boolean; size?: number }) {
  return (
    <Glyph size={size} units={24} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z" />
    </Glyph>
  );
}

export const ShareIcon = lucide(
  <>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
  </>,
  13,
);
export const HomeIcon = lucide(
  <>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </>,
  13,
);
export const MyWorkIcon = lucide(
  <>
    <path d={FOLDER_PATH} />
    <circle cx="12" cy="13" r="2" />
    <path d="M12 15v5" />
  </>,
  13,
);
export const LibraryIcon = lucide(<path d="m16 6 4 14M12 6v14M8 8v12M4 4v16" />, 13);
export const TeamIcon = lucide(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
  13,
);
export const SearchIcon = lucide(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>,
  14,
);

// A settings section, in the Search panel (the apps' Settings sliders).
export const SettingsGlyphIcon = lucide(
  <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />,
  13,
);

// ---------- Verbs ----------

export const SparkleIcon = lucide(
  <>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
  </>,
  13,
);
export const PlusIcon = lucide(<path d="M5 12h14M12 5v14" />, 12);
export const CheckIcon = lucide(<path d="M20 6 9 17l-5-5" />, 12);
export const PencilIcon = lucide(
  <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />,
  13,
);
export const DuplicateIcon = lucide(
  <>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </>,
  13,
);
export const CopyIcon = DuplicateIcon;
export const TrashIcon = lucide(
  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2" />,
  13,
);
export const OpenIcon = lucide(
  <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
  13,
);
export const RestoreIcon = lucide(
  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" />,
  13,
);
export const DismissIcon = lucide(<path d="M18 6 6 18M6 6l12 12" />, 13);
export const CloseIcon = lucide(<path d="M18 6 6 18M6 6l12 12" />, 14);
export const EllipsisIcon = lucide(
  <>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </>,
  14,
);
export const ChevronDownIcon = lucide(<path d="m6 9 6 6 6-6" />, 12);
export const ChevronRightIcon = lucide(<path d="m9 18 6-6-6-6" />, 12);
export const LinkIcon = lucide(
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />,
  13,
);
export const LockIcon = lucide(
  <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>,
  13,
);
export const EyeIcon = lucide(
  <>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </>,
  18,
);
export const PencilLineIcon = lucide(
  <>
    <path d="M12 20h9" />
    <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
  </>,
  18,
);
export const VoteIcon = lucide(
  <path d="m9 12 2 2 4-4M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7ZM22 19H2" />,
  18,
);
export const CommentIcon = lucide(
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  16,
);
export const ActionIcon = lucide(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>,
  16,
);

// An Inbox card row's glyph when the host draws none (lucide square-kanban), and a form's (lucide clipboard-list).
export const CardIcon = lucide(
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M8 7v7M12 7v4M16 7v9" />
  </>,
  16,
);
export const FormIcon = lucide(
  <>
    <rect width="8" height="4" x="8" y="2" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01" />
  </>,
  16,
);

// Why an Inbox row is there, beside its words: a mention (lucide at-sign), a thread you replied in (reply), an item
// of yours, and a person with no name (user).
export const AtSignIcon = lucide(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
  </>,
  12,
);
export const ReplyIcon = lucide(<path d="M20 18v-2a4 4 0 0 0-4-4H4M9 17l-5-5 5-5" />, 12);
export const UserIcon = lucide(
  <>
    <circle cx="12" cy="8" r="5" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </>,
  12,
);

// The two badge marks of liveplanner's VisibilityBadge, on their 9-unit grid.
export function TeamBadgeGlyph() {
  return (
    <Glyph size={9} units={9} strokeLinejoin="miter">
      <circle cx="3.2" cy="3.2" r="1.4" />
      <path d="M1.2 7.8c.3-1.4 1-2.1 2-2.1s1.7.7 2 2.1" />
      <circle cx="6.6" cy="3.6" r="1.1" />
      <path d="M6.3 5.7c.9.1 1.5.7 1.7 1.8" />
    </Glyph>
  );
}

export function PrivateBadgeGlyph() {
  return (
    <Glyph size={9} units={9}>
      <rect x="1.6" y="4" width="5.8" height="3.6" rx="0.9" />
      <path d="M3 4V2.9a1.5 1.5 0 0 1 3 0V4" />
    </Glyph>
  );
}

export function SharedDotGlyph() {
  return (
    <Glyph size={9} units={9}>
      <circle cx="4.5" cy="4.5" r="2" fill="currentColor" />
    </Glyph>
  );
}

// The placement browser's glyphs (liveplanner's PlacementCard), on a 20-unit grid.
export function PersonalSpaceIcon() {
  return (
    <Glyph size={20} units={20}>
      <path d="M3.5 8.5 10 3l6.5 5.5" />
      <path d="M5 7.5V16a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7.5" />
      <path d="M8 17v-4.5h4V17" />
    </Glyph>
  );
}

export function FolderPlaceIcon() {
  return (
    <Glyph size={20} units={20}>
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.6l1.8 2H15.5A1.5 1.5 0 0 1 17 7.5v7A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z" />
    </Glyph>
  );
}

export function FolderStackIcon() {
  return (
    <Glyph size={20} units={20}>
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.6l1.8 2H15.5A1.5 1.5 0 0 1 17 7.5v7A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z" />
      <path d="M6.5 12.9v-2.6c0-.44.36-.8.8-.8h1.5l.9 1h2.5c.44 0 .8.36.8.8v1.6c0 .44-.36.8-.8.8H7.3a.8.8 0 0 1-.8-.8Z" />
    </Glyph>
  );
}

export function NewFolderIcon() {
  return (
    <Glyph size={20} units={20}>
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.6l1.8 2H15.5A1.5 1.5 0 0 1 17 7.5v7A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z" />
      <path d="M10 9.2v4M8 11.2h4" />
    </Glyph>
  );
}

export function TeamPlaceIcon() {
  return (
    <Glyph size={20} units={20}>
      <circle cx="7.5" cy="7" r="2.6" />
      <path d="M3 16c.5-2.8 2.2-4.2 4.5-4.2S11.5 13.2 12 16" />
      <circle cx="13.8" cy="7.8" r="2" />
      <path d="M13.2 11.6c1.9.2 3.2 1.5 3.7 3.9" />
    </Glyph>
  );
}

export function HamburgerIcon() {
  return (
    <Glyph size={18} units={18} strokeLinejoin="miter">
      <path d="M3 5h12M3 9h12M3 13h12" />
    </Glyph>
  );
}

export function ListViewIcon() {
  return (
    <Glyph size={14} units={16} strokeLinejoin="miter">
      <path d="M5 4h8M5 8h8M5 12h8" />
      <circle cx="2.5" cy="4" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="8" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function GridViewIcon() {
  return (
    <Glyph size={14} units={16}>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </Glyph>
  );
}

export function DetailsViewIcon() {
  return (
    <Glyph size={14} units={16}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M2 6h12M2 9.5h12M6.5 6v7.5" />
    </Glyph>
  );
}

/** The `?` in a circle on the Help buttons. */
export function HelpMarkIcon() {
  return (
    <Glyph size={14} units={16} strokeLinejoin="miter">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M6.3 6.2a1.8 1.8 0 1 1 2.5 1.7c-.5.25-.9.65-.9 1.25v.3" strokeLinejoin="round" />
      <circle cx="8" cy="11.6" r="0.6" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** The small caret on a button that opens a menu (Create). */
export function CaretDownIcon() {
  return (
    <Glyph size={10} units={16} className="-mr-0.5">
      <path d="M4 6l4 4 4-4" />
    </Glyph>
  );
}

/** An `i` in a circle, for a quiet note (the Trash's). */
export const InfoIcon = lucide(
  <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-4M12 8h.01" />,
  14,
);

// A pin: a default folder (where new items land), on its marker and the Use as Default for… row.
export const DefaultPinIcon = lucide(
  <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />,
  12,
);
