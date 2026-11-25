import type { FieldChange } from '@liveplanner/api-schema';
import type { ApplySuccess } from '@liveplanner/edit-operations';
import { tabWithStyle, type Tab, type TabStyle } from '@liveplanner/project';

// A style changeset compiled (docs/specs/024-agents/agent-changesets.md "Style"): the tab restyled as the editor's
// pickers restyle it, whatever its kind. Agents paint in the light half, as a replace does, so the theme's colours
// land as its light half and every viewer still sees them in their own. The element colours it changes are written,
// recorded and relayed as any changeset's are; the tab's own fields ride with them (write.ts). Pure.

const STYLE_KEYS = ['theme', 'finish', 'font'] as const;

export function applyStyle(stored: Tab, style: TabStyle): ApplySuccess {
  const tab = tabWithStyle(stored, style, 'light');
  // One line for the tab, naming each part as it was and as it is: `~ tab  theme brand→forest · finish →sketch`.
  const changes: FieldChange[] = STYLE_KEYS.filter((key) => style[key] !== undefined).map(
    (key) => ({
      key,
      ...(stored[key] !== undefined ? { from: stored[key] } : {}),
      to: tab[key]!,
    }),
  );
  return {
    tab,
    results: [{ mark: '~', ref: 'tab', changes }],
    elementOps: [],
    inverse: [],
    warnings: [],
    targets: [],
    createdIds: [],
  };
}
