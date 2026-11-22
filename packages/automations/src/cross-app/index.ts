// Steps in other apps (blueprint cross-app.md "Kinds"): the five kinds, the chain and their words. Pure.
export * from './chain';
export * from './fill';
export * from './kinds';
export * from './words';
// The wire's types and limits, for an app whose rules are its own (liveplanner's), without a dependency of its own.
export {
  CROSS_APP_KINDS,
  CROSS_APP_STEPS_MAX,
  isCrossAppKind,
  type CrossAppChain,
  type CrossAppKind,
  type CrossAppStep,
  type CrossAppTarget,
  type CrossAppTargetedStep,
  type DocTabStep,
  type InboxNoticeStep,
  type KbPageStep,
  type PlanCardStep,
  type SpacePostStep,
} from '@liveworkspace/index-client';
