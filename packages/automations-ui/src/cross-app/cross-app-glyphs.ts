// The steps in other apps' icons (blueprint cross-app.md "In the builder"), apart from their pictures
// (cross-app-art.tsx): an editor draws a step's icon eagerly (a comment by a rule, its step preview), so this file
// stays as small as the icons it holds.
import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideBell,
  lucideBookOpenText,
  lucideFilePlus,
  lucideSquareKanban,
  lucideStickyNote,
} from '@liveworkspace/icons/lucide';
import type { CrossAppKind } from '@liveworkspace/automations/cross-app';
import type { GlyphType } from '../kit';

export const CROSS_APP_GLYPHS: Readonly<Record<CrossAppKind, GlyphType>> = {
  plan_card: lucideGlyph(lucideSquareKanban, 16),
  kb_page: lucideGlyph(lucideBookOpenText, 16),
  space_post: lucideGlyph(lucideStickyNote, 16),
  doc_tab: lucideGlyph(lucideFilePlus, 16),
  inbox_notice: lucideGlyph(lucideBell, 16),
};
