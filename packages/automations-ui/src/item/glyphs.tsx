'use client';

// The shared steps' icons on their blue tiles (blueprint item-ui.md "Kinds"), by tile key. The message steps' and
// Wait's are stage 3's (glyphs.tsx).

import { SparkleIcon, lucideGlyph } from '@liveworkspace/ui';
import { lucideHistory, lucideMail, lucideSquarePlus } from '@liveworkspace/icons/lucide';
import { NOTIFY_GLYPHS, WaitGlyph } from '../glyphs';
import type { GlyphType } from '../kit';
import { CameraGlyph } from './scenes/scene-bits';

export const ITEM_ACTION_GLYPHS: Readonly<Record<string, GlyphType>> = {
  take_snapshot: CameraGlyph,
  revert_snapshot: lucideGlyph(lucideHistory, 16),
  email: lucideGlyph(lucideMail, 16),
  add_tab: lucideGlyph(lucideSquarePlus, 16),
  notify_webhook: NOTIFY_GLYPHS.webhook,
  notify_slack: NOTIFY_GLYPHS.slack,
  notify_teams: NOTIFY_GLYPHS.teams,
  ai_summarise: SparkleIcon,
  wait: WaitGlyph,
};
