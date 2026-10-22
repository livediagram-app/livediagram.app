// The mode the scenes' editor window is in (docs/specs/007-editor/editor-modes.md). liveplanner is
// Plan mode alone, so every scene's window wears Plan's glyph and name on its mode switch and tabs,
// and a Plan tab brings its own bar where another mode's palette would be (hero-plan-bars.tsx).

import { EDITOR_MODE_ICONS, type IconProps } from '@liveplanner/ui';
import type { ComponentType } from 'react';

export type HeroMode = 'plan';

// The mode's name and its glyph, drawn from the editor's own icons.
export const HERO_MODE: Record<HeroMode, { label: string; Icon: ComponentType<IconProps> }> = {
  plan: { label: 'Plan', Icon: EDITOR_MODE_ICONS.plan },
};
