import type { Caller, Person } from './auth';
import type { DriveTouched } from './drive';
import type { Env } from './env';

// What every person-facing route is handed.
export type RouteContext = {
  request: Request;
  env: Env;
  url: URL;
  // The path below /api/index, split.
  segments: string[];
  caller: Caller;
  waitUntil: (promise: Promise<unknown>) => void;
  // The people whose personal items or folders this request changed: the Drive mirror's signal, once it answers.
  drive: DriveTouched;
};

export type PersonContext = RouteContext & { person: Person };
