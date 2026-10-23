// A tab's default name: "Tab N", what a tab is called until someone names it.
const DEFAULT_TAB_NAME = /^Tab \d+$/;

export function defaultTabName(n: number): string {
  return `Tab ${n}`;
}

export function isDefaultTabName(name: string): boolean {
  return DEFAULT_TAB_NAME.test(name.trim());
}
