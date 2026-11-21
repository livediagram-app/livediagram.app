// @liveworkspace/automations/item: the rules engine for an item with no cards, the pure half
// (liveworkspace/docs/specs/018-automations/automations.md; blueprint item-engine.md "The pure entry"). The event and
// rule shapes, the kinds registry with the kinds every app has, the check, the words, the collab diff, the AI's
// requests and readers, templates and rules in a file. Runs anywhere; the room's half is under
// `@liveworkspace/automations/room`.
export * from './types';
export * from './names';
export * from './refs';
export * from './kinds';
export * from './define';
export * from './triggers';
export * from './conditions';
export * from './actions';
export * from './values';
export * from './validate';
export * from './words';
export * from './summary';
export * from './collab';
export * from './ai';
export * from './templates';
export * from './file';
