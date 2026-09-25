// The six category glyphs for the Settings list, drawn iOS-style: a white
// line-art mark on a filled, rounded colour tile. The tile colour is the
// thing the eye actually navigates by once the labels blur together, so each
// category owns a distinct hue and keeps it in both the mobile root list and
// the desktop sidebar.
//
// Drawn here rather than pulled from @livediagram/icons because that package
// is the canvas catalogue (what a user places on a diagram); these are chrome,
// sized for a 28px tile and stroked to read at that size.

import type { ReactNode } from 'react';

export type SettingsCategoryId =
  | 'account'
  | 'editor'
  | 'appearance'
  | 'controls'
  | 'panels'
  | 'notifications'
  | 'accessibility'
  | 'ai'
  | 'privacy';

// Tailwind classes rather than hexes so the tiles follow the same dark-mode
// pass as the rest of the chrome. Each hue is distinct at a glance AND when
// desaturated, so the list stays navigable for a colour-blind reader, the
// glyphs differ too, the colour is a second channel, never the only one.
const TILE: Record<SettingsCategoryId, string> = {
  account: 'bg-teal-600',
  editor: 'bg-blue-500',
  appearance: 'bg-sky-600',
  controls: 'bg-slate-500',
  panels: 'bg-amber-500',
  notifications: 'bg-rose-500',
  accessibility: 'bg-indigo-500',
  ai: 'bg-violet-500',
  privacy: 'bg-emerald-600',
};

// One tile: the coloured rounded square with its glyph centred.
export function SettingsCategoryIcon({ id }: { id: SettingsCategoryId }) {
  return (
    <span
      aria-hidden
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-white ${TILE[id]}`}
    >
      {GLYPHS[id]}
    </span>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

// Editor: the panel layout itself: a frame with a docked side panel, which
// is what the group's settings (minimal panels, minimap) rearrange.
const EditorGlyph = (
  <Svg>
    <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
    <path d="M12 3.5v13" />
  </Svg>
);

// Controls: a pointer. A mouse outline was the obvious draw for a group
// about middle-mouse panning, but a rounded capsule with a wheel line inside
// reads as a hollow "0" once it is shrunk to a 16px tile.
const ControlsGlyph = (
  <Svg>
    <path d="M4.5 3.2 15 9.4l-4.3 1.1-1.5 4.4L4.5 3.2Z" />
    <path d="m11.4 12.1 3.6 4.2" />
  </Svg>
);

// Account: a person.
const AccountGlyph = (
  <Svg>
    <circle cx="10" cy="7" r="3.2" />
    <path d="M4 16.5a6 6 0 0 1 12 0" />
  </Svg>
);

// Appearance: a half-filled circle, the standard light/dark mark.
const AppearanceGlyph = (
  <Svg>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor" stroke="none" />
  </Svg>
);

// Panels: stacked sheets, for the floating panels these settings dress.
const PanelsGlyph = (
  <Svg>
    <rect x="2.5" y="6.5" width="11" height="11" rx="2" />
    <path d="M6.5 6.5v-3a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3" />
  </Svg>
);

// Notifications: a bell.
const NotificationsGlyph = (
  <Svg>
    <path d="M6 8.5a4 4 0 0 1 8 0c0 3 1.2 4.2 1.7 4.7a.5.5 0 0 1-.35.85H4.65a.5.5 0 0 1-.35-.85C4.8 12.7 6 11.5 6 8.5Z" />
    <path d="M8.5 16.5a1.8 1.8 0 0 0 3 0" />
  </Svg>
);

// Accessibility: the standard accessibility figure, the one mark a reader
// already knows means this group.
const AccessibilityGlyph = (
  <Svg>
    <circle cx="10" cy="4" r="1.6" />
    <path d="M4.5 7.5c3.5 1.2 7.5 1.2 11 0" />
    <path d="M10 7.8v4.2" />
    <path d="m10 12 -2.6 5.2" />
    <path d="m10 12 2.6 5.2" />
  </Svg>
);

// AI: a spark.
const AiGlyph = (
  <Svg>
    <path d="M10 2.5c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5Z" />
    <path d="M15.5 13.5c.25 1.4.65 1.8 2 2-1.35.25-1.75.65-2 2-.25-1.35-.65-1.75-2-2 1.35-.2 1.75-.6 2-2Z" />
  </Svg>
);

// Privacy: a padlock.
const PrivacyGlyph = (
  <Svg>
    <rect x="4" y="8.5" width="12" height="9" rx="2" />
    <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" />
  </Svg>
);

const GLYPHS: Record<SettingsCategoryId, ReactNode> = {
  account: AccountGlyph,
  editor: EditorGlyph,
  appearance: AppearanceGlyph,
  controls: ControlsGlyph,
  panels: PanelsGlyph,
  notifications: NotificationsGlyph,
  accessibility: AccessibilityGlyph,
  ai: AiGlyph,
  privacy: PrivacyGlyph,
};
