// A tab's default name (docs/specs/026-plan/plan-board.md "The board set-up"): "Tab N", what a tab is called until someone
// names it. A Plan board or Sheet placed on a tab takes the tab's name, and follows it when the tab is renamed away
// from its default (docs/specs/026-plan/plan-board.md "The board set-up").
const DEFAULT_TAB_NAME = /^Tab \d+$/;

export function defaultTabName(n: number): string {
  return `Tab ${n}`;
}

export function isDefaultTabName(name: string): boolean {
  return DEFAULT_TAB_NAME.test(name.trim());
}
