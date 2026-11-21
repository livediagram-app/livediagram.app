// The knowledge chrome's icons (docs/specs/004-interface-design/iconography.md): vendored Lucide glyphs at the
// chrome's size, as the page tree's are.
import {
  lucideCalendarClock,
  lucideCheck,
  lucideCircleDashed,
  lucideHistory,
  lucideShieldCheck,
  lucideTriangleAlert,
  lucideCircleCheck,
  lucideClock,
  lucideExternalLink,
  lucideFilePlus,
  lucideFileText,
  lucideLayers,
  lucidePanelRight,
  lucideSearch,
  lucideSparkles,
  lucideUser,
  lucideUsers,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

export const TickIcon = lucideGlyph(lucideCircleCheck, 16);
export const CheckIcon = lucideGlyph(lucideCheck, 16);
export const ContextIcon = lucideGlyph(lucideLayers, 16);
export const PageInfoIcon = lucideGlyph(lucidePanelRight, 16);
export const CloseIcon = lucideGlyph(lucideX, 16);
export const ClockIcon = lucideGlyph(lucideClock, 14);
// Page Health: the state's glyph in its ring, and each fact's row.
export const VerifiedIcon = lucideGlyph(lucideShieldCheck, 18);
export const DueIcon = lucideGlyph(lucideTriangleAlert, 18);
export const UnverifiedIcon = lucideGlyph(lucideCircleDashed, 18);
export const OwnerIcon = lucideGlyph(lucideUser, 14);
export const VerifiedRowIcon = lucideGlyph(lucideShieldCheck, 14);
export const DueRowIcon = lucideGlyph(lucideCalendarClock, 14);
export const PeriodIcon = lucideGlyph(lucideHistory, 14);
export const PeopleIcon = lucideGlyph(lucideUsers, 14);
export const AgentsIcon = lucideGlyph(lucideSparkles, 14);
// The meta row's maker pills: a sparkle for an agent's, a person for a person's, at the pill's size.
export const MakerAgentIcon = lucideGlyph(lucideSparkles, 12);
export const MakerPersonIcon = lucideGlyph(lucideUser, 12);
export const SearchIcon = lucideGlyph(lucideSearch, 16);
export const PageIcon = lucideGlyph(lucideFileText, 16);
export const NewPageIcon = lucideGlyph(lucideFilePlus, 16);
export const OpenIcon = lucideGlyph(lucideExternalLink, 14);
