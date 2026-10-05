import type { ComponentType } from 'react';
import {
  PLACEMENT_DEFAULT_KEYS,
  type PlacementDefaultKey,
  type SpecificTabKind,
  type TemplateFamily,
} from '@livediagram/api-schema';
import type { EditorMode } from '@livediagram/document';
import { lucideGlyph, type IconProps, EDITOR_MODE_ICONS } from '@livediagram/ui';
import {
  lucideFolderCheck,
  lucideHistory,
  lucideSquareKanban,
  lucideStickyNote,
} from '@livediagram/icons/lucide';

// Each default key's icon (docs/specs/013-workspace/default-folders.md "Entry names", blueprint D110):
// a mode keeps the icon its mode switch shows; the kind and the families each draw what they are.
// Typed per dimension, so a new mode, kind or family needs its icon before it compiles. Shapes
// differ, so the marker never says anything by colour alone.

const KIND_ICON: Record<SpecificTabKind, ComponentType<IconProps>> = {
  'event-storming': lucideGlyph(lucideStickyNote, 14),
};

const FAMILY_ICON: Record<TemplateFamily, ComponentType<IconProps>> = {
  retrospective: lucideGlyph(lucideHistory, 14),
  kanban: lucideGlyph(lucideSquareKanban, 14),
};

function iconOf(key: PlacementDefaultKey): ComponentType<IconProps> {
  const [dimension, value] = key.split(':') as [string, string];
  if (dimension === 'mode') return EDITOR_MODE_ICONS[value as EditorMode];
  if (dimension === 'kind') return KIND_ICON[value as SpecificTabKind];
  return FAMILY_ICON[value as TemplateFamily];
}

/** Every key's icon, built once. */
export const DEFAULT_KEY_ICONS = Object.fromEntries(
  PLACEMENT_DEFAULT_KEYS.map((key) => [key, iconOf(key)]),
) as Record<PlacementDefaultKey, ComponentType<IconProps>>;

export function DefaultKeyIcon({
  entryKey,
  size = 14,
}: {
  entryKey: PlacementDefaultKey;
  size?: number;
}) {
  const Icon = DEFAULT_KEY_ICONS[entryKey];
  return <Icon size={size} />;
}

/** The "Use as default for" row's icon (blueprint D118). */
export const UseAsDefaultIcon = lucideGlyph(lucideFolderCheck, 16);
