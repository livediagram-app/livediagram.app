import { vi } from 'vitest';
import type { SettingsCategory, SettingsRow } from '../model';

// A small Settings shaped like an app's: Editor, Panels with three sub-categories, Privacy.
export function fixtureCategories(overrides: Partial<Record<string, SettingsRow[]>> = {}) {
  const toggle = (key: string, label: string, extra: Partial<SettingsRow> = {}): SettingsRow =>
    ({
      kind: 'toggle',
      key,
      label,
      description: `${label} description.`,
      value: false,
      onChange: vi.fn(),
      ...extra,
    }) as SettingsRow;
  const categories: SettingsCategory[] = [
    {
      id: 'editor',
      label: 'Editor',
      rows: overrides.editor ?? [
        toggle('alignmentGuides', 'Alignment Guides', { section: 'Canvas', keywords: 'snap' }),
        toggle('autoAttach', 'Auto-Attach Arrows', { section: 'Canvas' }),
        toggle('quickAdd', 'Quick-Add on Hover', {
          section: 'Mouse',
          desktopOnly: 'Desktop only.',
        }),
      ],
    },
    {
      id: 'panels',
      label: 'Panels',
      rows: overrides.panels ?? [toggle('panelOpacityOn', 'Panel Look')],
    },
    { id: 'layers', label: 'Layers', parent: 'panels', rows: [toggle('layersOn', 'Show Layers')] },
    { id: 'map', label: 'Map', parent: 'panels', rows: [toggle('showMinimap', 'Show Map')] },
    {
      id: 'collaborate',
      label: 'Collaborate',
      parent: 'panels',
      rows: [toggle('collabOn', 'Show Collaborate')],
    },
    {
      id: 'privacy',
      label: 'Privacy',
      rows: overrides.privacy ?? [toggle('telemetryEnabled', 'Usage Data')],
    },
  ];
  return categories;
}
