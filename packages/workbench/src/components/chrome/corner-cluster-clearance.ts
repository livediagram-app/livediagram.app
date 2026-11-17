// How high a bottom-centre notice sits to stay clear of the canvas's bottom-right cluster (undo, redo, the theme
// brush, zoom) in every editor. The cluster is `absolute bottom-4 right-4` above the tab bar, a 46px row at a 16px
// inset, so its top is 110px above the viewport's bottom at 100% (measured in livedesign at 390, 450, 1280 and 1440px;
// the other editors draw the same cluster over the same 48px tab bar). On a phone and at narrow widths it spans most
// of the row, and up to about 1400px a centred 448px notice still reaches it. The cluster is drawn at the corner
// buttons' UI scale (CSS `zoom`, inset included), so the clearance takes the largest scale, plus a 12px gap.
import { UI_SCALE_MAX } from '../../lib/ui-scale';

export const TAB_BAR_PX = 48;
/** The cluster's inset and row at 100%: `bottom-4` (16px) and its 46px row. */
export const CORNER_CLUSTER_PX = 16 + 46;
export const CORNER_CLUSTER_GAP_PX = 12;

/** The bottom offset, in px, that clears the cluster at the largest UI scale. */
export const CORNER_CLUSTER_CLEARANCE_PX = Math.ceil(
  TAB_BAR_PX + CORNER_CLUSTER_PX * UI_SCALE_MAX + CORNER_CLUSTER_GAP_PX,
);

/** The same offset as a static Tailwind class (its number is checked against CORNER_CLUSTER_CLEARANCE_PX). */
export const CORNER_CLUSTER_CLEARANCE = 'bottom-[135px]';
