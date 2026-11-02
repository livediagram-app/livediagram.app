// This product's validator and migrations, bound for the room's element gate (docs/specs/012-collaboration/
// realtime-conflict-resolution.md "An invalid element", docs/specs/015-api/blueprints/room-element-ops.md). The room
// judges an Editor's element op the way the tab save judges a tab: migrated first, then validated.
import {
  ELEMENT_TYPES,
  elementValidationIssue,
  MAX_ELEMENTS_PER_TAB,
  migrateIncomingElements,
  migrateIncomingTab,
} from '@livedesign/design';
import type { RoomElementRules } from '@liveworkspace/api-kit/room-element-ops';

export const ROOM_ELEMENT_RULES: RoomElementRules = {
  knowsType: (type) => ELEMENT_TYPES.has(type),
  migrateElement: (element) => migrateIncomingElements([element])[0],
  migrateTab: migrateIncomingTab,
  issue: elementValidationIssue,
  maxElements: MAX_ELEMENTS_PER_TAB,
};
