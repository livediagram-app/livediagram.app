// Types for checks.mjs: the snapshot is what the tools answered, so its records stay loose (`unknown` values where
// the tools' own shapes vary by element or field kind).

export type Word = string | RegExp;
export type Element = Record<string, unknown>;
export interface Tab {
  id: string;
  name?: string;
  outline?: string;
  elements: Element[];
  pages?: string;
}
export interface Snapshot {
  documents: {
    id: string;
    name?: string;
    missing?: boolean;
    tabs?: Tab[];
  }[];
}
export interface Page {
  tabId: string;
  n: number;
  name: string | null;
  kind: string;
  format: string;
  elements: number | null;
}
export interface Reasoned {
  pass: boolean;
  detail: string | null;
}
export interface CheckContext {
  snap: Snapshot;
  run: { finalText?: string; [key: string]: unknown };
}
export type CheckResult = boolean | { pass: boolean; detail?: string | null };
export interface CheckOutcome {
  name: string;
  pass: boolean;
  detail: string | null;
}

export declare function elementsOf(snap: Snapshot): Element[];
export declare function find(snap: Snapshot, word: Word): Element[];
export declare function atLeast(n: number, have: number, what: string): Reasoned;
export declare function mentionsAll(snap: Snapshot, words: Word[]): Reasoned;
export declare function pagesOf(snap: Snapshot): Page[];
export declare function runChecks(
  task: { checks?: readonly (readonly [string, (ctx: CheckContext) => CheckResult])[] },
  ctx: CheckContext,
): CheckOutcome[];
