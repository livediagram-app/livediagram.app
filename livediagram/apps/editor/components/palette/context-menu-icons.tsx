// Icons of the editor's context menus (element, multi-selection, canvas, layer row). One family
// (docs/specs/004-interface-design/iconography.md, "Size steps"): row and section icons render at
// MENU_ICON_PX, the pinned quick-action buttons at QUICK_ACTION_ICON_PX, all on the 24-unit grid so
// their ink reads the same size. Lucide where it has the meaning; in-house glyphs follow the same grid.
// Option tiles (animation kinds, layout styles, rotation) are previews and keep their own drawing.

import { LinkIcon, lucideGlyph } from '@livediagram/ui';
import {
  lucideChartNoAxesColumnIncreasing,
  lucideCircleCheck,
  lucideHeartPulse,
  lucideTimer,
} from '@liveworkspace/icons/lucide';
import { MENU_ICON_PX } from '@liveworkspace/workbench/components/palette/context-menu-icons';

export function LinkMenuIcon() {
  return <LinkIcon size={MENU_ICON_PX} />;
}

// The Resources row's Live Status (docs/specs/009-elements/live-status.md "The Live Status dialog"): a service's pulse.
export const LiveStatusMenuIcon = lucideGlyph(lucideHeartPulse, MENU_ICON_PX);

// The Timer session-tool category glyph.
export const TimerMenuIcon = lucideGlyph(lucideTimer, MENU_ICON_PX);
// The Vote session-tool category glyph (a cast dot-vote).
export const VoteMenuIcon = lucideGlyph(lucideCircleCheck, MENU_ICON_PX);
// The Poll session-tool category glyph (docs/specs/012-collaboration/live-poll.md, a live tally),
// distinct from Vote's check: a poll counts answers from people.
export const PollMenuIcon = lucideGlyph(lucideChartNoAxesColumnIncreasing, MENU_ICON_PX);
