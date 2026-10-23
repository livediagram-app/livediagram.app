// A tab's default name: "Tab N", what a tab is called until someone
// names it. A Plan board or Sheet placed on a tab takes the tab's name, and follows it when the tab is renamed away
// from its default.
const DEFAULT_TAB_NAME = /^Tab \d+$/;

export function defaultTabName(n: number): string {
  return `Tab ${n}`;
}

export function isDefaultTabName(name: string): boolean {
  return DEFAULT_TAB_NAME.test(name.trim());
}
