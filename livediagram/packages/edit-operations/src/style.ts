// `applyTabStyle` (docs/specs/024-agents/blueprints/agent-changesets.md "The pipeline"): the third changeset body, an
// existing tab restyled as the Tab Style dialog restyles it (docs/specs/011-theme/canvas-and-theme-dialog.md "Agents"),
// answered with the same outcome as operations and a replace. The theme is applied in the light half, as an agent's
// new tabs are painted; the finish and the font apply to the whole tab, the elements' own cleared.

import {
  diffToElementOps,
  invertElementOps,
  tabWithTheme,
  withTabFinish,
  withTabFont,
  type Tab,
  type TabStyle,
} from '@livediagram/document';
import type { FieldChange } from '@livediagram/api-schema';
import { tabLocked } from './rejections';
import type { ApplyOutcome, EditLog } from './types';

export function applyTabStyle(
  tab: Tab,
  style: TabStyle,
  options: { log?: EditLog } = {},
): ApplyOutcome {
  const log: EditLog = options.log ?? (() => {});
  if (tab.locked) {
    log('[edit-ops] locked', { operation: 0, op: 'style', scope: 'tab' });
    return { errors: [tabLocked()] };
  }
  let next = style.theme !== undefined ? tabWithTheme(tab, style.theme, 'light') : tab;
  if (style.finish !== undefined) next = withTabFinish(next, style.finish);
  if (style.font !== undefined) next = withTabFont(next, style.font);
  const elementOps = diffToElementOps(tab.elements, next.elements);
  log('[edit-ops] style', { fields: Object.keys(style).join(','), elements: elementOps.length });
  // One line for the tab: each field asked for, from what it was. Recoloured elements are counted, not listed: a theme
  // touches most of the tab, and the answer says what changed rather than repeating the tab.
  const changes: FieldChange[] = (['theme', 'finish', 'font'] as const)
    .filter((key) => style[key] !== undefined)
    .map((key) => ({ key, from: tab[key] ?? null, to: style[key]! }));
  if (elementOps.length > 0) changes.push({ key: 'elements', to: elementOps.length });
  return {
    tab: next,
    results: [{ mark: '~', ref: 'tab', changes }],
    elementOps,
    inverse: invertElementOps(tab.elements, elementOps),
    warnings: [],
    targets: [],
    createdIds: [],
  };
}
