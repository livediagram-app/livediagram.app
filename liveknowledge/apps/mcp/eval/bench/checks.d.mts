// Types for checks.mjs: the snapshot is what the tools answered, read back page by page.

export type Word = string | RegExp;
export interface Page {
  page: string;
  title: string;
  depth: number;
  parent?: string;
  verified: string;
  markdown: string;
  documentId?: string;
}
export interface Snapshot {
  documents: {
    id: string;
    name?: string;
    missing?: boolean;
    pages?: Page[];
  }[];
}
export interface Reasoned {
  pass: boolean;
  detail: string | null;
}
export interface Run {
  finalText?: string;
  calls?: { tool?: string; isError?: boolean }[];
  [key: string]: unknown;
}
export interface CheckContext {
  snap: Snapshot;
  run: Run;
}
export type CheckResult = boolean | { pass: boolean; detail?: string | null };
export interface CheckOutcome {
  name: string;
  pass: boolean;
  detail: string | null;
}

export declare function pagesOf(snap: Snapshot): Page[];
export declare function pagesTitled(snap: Snapshot, word: Word): Page[];
export declare function pagesUnder(snap: Snapshot, word: Word): Page[];
export declare function linksOf(page: Pick<Page, 'markdown'>): string[];
export declare function mentions(snap: Snapshot, ...words: Word[]): boolean;
export declare function mentionsAll(snap: Snapshot, words: Word[]): Reasoned;
export declare function atLeast(n: number, have: number, what: string): Reasoned;
export declare function toolsCalled(run: Run): string[];
export declare function called(run: Run, tool: string): boolean;
export declare function contextFirst(run: Run): Reasoned;
export declare function replied(run: Run, word: Word): boolean;
export declare function runChecks(
  task: { checks?: readonly (readonly [string, (ctx: CheckContext) => CheckResult])[] },
  ctx: CheckContext,
): CheckOutcome[];
