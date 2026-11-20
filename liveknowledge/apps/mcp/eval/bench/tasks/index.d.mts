import type { CheckContext, CheckResult } from '../checks.mjs';

/** One check: a requirement of the prompt, answered yes or no (with a reason); see ../checks.mjs. */
export type Check = readonly [name: string, fn: (ctx: CheckContext) => CheckResult];

export interface Task {
  id: string;
  area: string;
  level: string;
  prompt: string;
  after?: string;
  setup?: (client: unknown) => Promise<string[]>;
  checks: Check[];
}

export declare const TASKS: Task[];
export declare function taskById(id: string): Task;
export declare function selectTasks(spec?: string): Task[];
