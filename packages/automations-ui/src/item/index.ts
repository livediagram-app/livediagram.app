// @liveworkspace/automations-ui/item: the Automations screen for an item whose rules are about its tabs (blueprint
// item-ui.md). One helper turns an app's kinds registry into a whole `AutomationsKit`; the panels, pictures and
// parts it is made of are exported for an app's own kinds to build with. Loaded with the lazy screen, never with an
// editor's first paint: the light half is `./item/plumbing`.

export { defineItemAutomationsKit, lastStepOf, templateShape } from './define-kit';
export type {
  ItemAutomationsKitInput,
  ItemOwnAction,
  ItemOwnCondition,
  ItemOwnTrigger,
  ItemSnapshot,
  ItemSnapshots,
  ItemTabTemplate,
  ItemUiOutline,
  ItemView,
  ItemVignette,
  OnceStatus,
} from './types';
export { buildItemKinds, freshMessage, type ItemKitKinds } from './kit-kinds';
export { buildOutline, listsNamed, makeUseItemOutline, snapshotLabel } from './outline';
export {
  actionGroupsOf,
  actionKeysOf,
  groupId,
  itemValueGroups,
  ruleWantsTab,
  summarisedBefore,
  triggerGroupsOf,
} from './rule-reads';
export {
  ITEM_REFUSAL_PICKS,
  goneLabel,
  needWord,
  needWords,
  pickWords,
  runRefusalWords,
  runToast,
  startsWhen,
  tileLine,
} from './words';
export { ItemRunRule, runOffered } from './ItemRunRule';
export { itemTestRule } from './ItemTestRule';
export { TabAskDialog, firstTab } from './TabAskDialog';
export { ITEM_ACTION_GLYPHS } from './glyphs';
// The panels, for an app's own kind that is shaped like a shared one.
export { TabSelect, withTab } from './panels/panel-bits';
export {
  EditedPanel,
  ItemIncomingPanel,
  NotEditedPanel,
  QUIET_PRESETS,
  TabTriggerPanel,
  startsWhenPanel,
} from './panels/trigger-panels';
export {
  TabConditionPanel,
  WeekdayConditionPanel,
  WhoConditionPanel,
  textConditionPanel,
} from './panels/condition-panels';
export { RevertSnapshotPanel, TakeSnapshotPanel } from './panels/snapshot-panels';
export { AddTabPanel, ItemEmailPanel, summarisePanel } from './panels/action-panels';
// The pictures and their parts, for an app's own vignettes.
export { ACTION_SCENES } from './scenes/action-scenes';
export { TRIGGER_SCENES } from './scenes/trigger-scenes';
export { ItemTemplateScene, TemplatePair } from './scenes/ItemTemplateScene';
export {
  Board,
  CameraGlyph,
  CommentBubble,
  Fire,
  FlowLine,
  GlyphTile,
  Page,
  Tab,
  TabStrip,
} from './scenes/scene-bits';
