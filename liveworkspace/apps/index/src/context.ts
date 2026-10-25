import type { Caller, Person } from './auth';
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
};

export type PersonContext = RouteContext & { person: Person };
