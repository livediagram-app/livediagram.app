import { lucideCircleX, lucideFolder, lucideUsers } from '@liveworkspace/icons/lucide';

import { Glyph, type IconProps } from './Glyph';
import { lucideGlyph } from './lucide-glyph';

// Status + label glyphs: the share-state badge dots (docs/specs/013-workspace/share-password.md), the
// Tabs label, the sign-in sparkle and the error-state crossed circle. The
// marketing hero illustration draws the editor's chrome with these same
// components, so the two can't drift apart.

// The 9px badges are drawn for their size (a 24-unit glyph turns to mud at 9px).
// Connected nodes on a 9-unit viewBox: the "Shared" badge.
export function SharedDotIcon({ size = 9, ...rest }: IconProps) {
  return (
    <Glyph size={size} units={9} {...rest}>
      <circle cx="2" cy="4.5" r="1.4" />
      <circle cx="7" cy="2" r="1.2" />
      <circle cx="7" cy="7" r="1.2" />
      <path d="M3.2 3.8L5.9 2.5M3.2 5.2L5.9 6.5" />
    </Glyph>
  );
}

// Padlock on a 9-unit viewBox: the "Private" badge.
export function PrivateDotIcon({ size = 9, ...rest }: IconProps) {
  return (
    <Glyph size={size} units={9} {...rest}>
      <rect x="2" y="4" width="5" height="3.5" rx="0.8" />
      <path d="M3.25 4V3a1.25 1.25 0 0 1 2.5 0v1" />
    </Glyph>
  );
}

// A folder, paired with the tab bar's TABS label.
export const TabsLabelIcon = /* @__PURE__ */ lucideGlyph(lucideFolder, 11);

// A large and a small four-point star, filled: the sign-in prompts.
export function SparkleIcon({ size = 14, ...rest }: IconProps) {
  return (
    <Glyph size={size} filled {...rest}>
      <path d="M6.75 1.5 7.95 5.4 11.75 6.6 7.95 7.8 6.75 11.7 5.55 7.8 1.75 6.6 5.55 5.4 6.75 1.5Z" />
      <path d="M11.75 10.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z" />
    </Glyph>
  );
}

// One four-point star, filled, drawn for a small size on a 10-unit viewBox: an agent's mark, inside its avatar disc
// (docs/specs/024-agents/agent-presence.md "Presence"), legible down to the tab pill's 16px avatar.
export function AgentIcon({ size = 10, ...rest }: IconProps) {
  return (
    <Glyph size={size} units={10} filled {...rest}>
      <path d="M5 .6 6.15 3.85 9.4 5 6.15 6.15 5 9.4 3.85 6.15.6 5 3.85 3.85Z" />
    </Glyph>
  );
}

// A crossed-out circle: the "not found" / "no access" error cards.
export const CircleXIcon = /* @__PURE__ */ lucideGlyph(lucideCircleX, 28);

// Two people: a team (docs/specs/013-workspace/teams.md), its spaces in the Explorer and its work
// wherever it is listed beside your own.
export const TeamIcon = /* @__PURE__ */ lucideGlyph(lucideUsers, 13);
