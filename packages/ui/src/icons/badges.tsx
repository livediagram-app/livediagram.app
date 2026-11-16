import {
  lucideClipboardCheck,
  lucideLink,
  lucideListTree,
  lucideMessageSquare,
  lucideStickyNote,
  lucideTable,
  lucideWandSparkles,
} from '@liveworkspace/icons/lucide';

import { lucideGlyph } from './lucide-glyph';

// Element badges: link, note, action, comment, and a mind map's outline. Lucide geometry.
export const LinkIcon = /* @__PURE__ */ lucideGlyph(lucideLink, 14);
// A chart linked to a sheet in another item (livedocuments pie-chart.md "Charts linked to a liveplanner sheet").
export const SheetLinkIcon = /* @__PURE__ */ lucideGlyph(lucideTable, 14);
export const NoteIcon = /* @__PURE__ */ lucideGlyph(lucideStickyNote, 12);
export const ActionIcon = /* @__PURE__ */ lucideGlyph(lucideClipboardCheck, 12);
export const CommentIcon = /* @__PURE__ */ lucideGlyph(lucideMessageSquare, 16);
// A mind map edited as an outline (docs/specs/009-elements/mind-node.md "Edit Outline").
export const MindOutlineIcon = /* @__PURE__ */ lucideGlyph(lucideListTree, 13);
// Tidy Map: a mind map laid out tidily again.
export const TidyMapIcon = /* @__PURE__ */ lucideGlyph(lucideWandSparkles, 13);
