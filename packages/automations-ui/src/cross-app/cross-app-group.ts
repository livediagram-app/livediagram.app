// Add an Action's In Other Apps group (liveworkspace/docs/specs/018-automations/automations.md "Steps in other apps";
// blueprint cross-app.md "In the builder"): the five steps every app offers, badged New, with who they act as under
// the tiles. Pure, so every app's kit (the item kits and liveplanner's) marks the group the same way.
import { CROSS_APP_GROUP, CROSS_APP_KINDS } from '@liveworkspace/automations/cross-app';
import type { KindGroup } from '../kit';

export const CROSS_APP_GROUP_ID = 'in-other-apps';
export const CROSS_APP_FOOTNOTE = 'Every step acts as you, and only on items you can edit.';

/** The group's marks: its pill and its line under the tiles. */
export const crossAppGroupMarks = (): Pick<KindGroup, 'badge' | 'footnote'> => ({
  badge: 'New',
  footnote: CROSS_APP_FOOTNOTE,
});

/** The whole group, for an app whose groups are its own (liveplanner's). */
export const crossAppGroup = (): KindGroup => ({
  id: CROSS_APP_GROUP_ID,
  name: CROSS_APP_GROUP,
  kinds: [...CROSS_APP_KINDS],
  ...crossAppGroupMarks(),
});
