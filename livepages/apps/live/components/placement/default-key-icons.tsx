import type { ComponentType } from 'react';
import { PLACEMENT_DEFAULT_KEYS, type PlacementDefaultKey } from '@livepages/api-schema';
import type { EditorMode } from '@livepages/document';
import { lucideGlyph, type IconProps, EDITOR_MODE_ICONS } from '@livepages/ui';
import { lucideFolderCheck } from '@livepages/icons/lucide';

// Each default key's icon (docs/specs/013-workspace/default-folders.md "Entry names", blueprint D110):
// a mode keeps the icon its mode's mark shows.

function iconOf(key: PlacementDefaultKey): ComponentType<IconProps> {
  return EDITOR_MODE_ICONS[key.slice('mode:'.length) as EditorMode];
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

/** The "Use as Default for" row's icon (blueprint D118). */
export const UseAsDefaultIcon = lucideGlyph(lucideFolderCheck, 16);
