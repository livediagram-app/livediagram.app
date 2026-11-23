/** What a request read of its path: segment indexes, or `whole` when a read was not followed; see route-sweep.js. */
export interface PathReads {
  reads: Set<number>;
  whole: boolean;
}
/** Runs `run` while every read of `path` (no leading slash) is recorded, until `run` calls `stop`; see route-sweep.js. */
export declare function tracePathReads<T>(
  path: string,
  run: (stop: () => void) => Promise<T>,
): Promise<{ value: T } & PathReads>;
/** One class of paths of one length in one method, split at `at` where the dispatch read on; see route-sweep.js. */
export interface SweepNode<R> {
  path: string[];
  result: R;
  at?: number;
  children?: Map<string, SweepNode<R>>;
}
/** Every class of paths the dispatch tells apart, each sent once; see route-sweep.js. */
export declare function sweepPaths<R>(options: {
  root: string;
  vocabulary: Map<number, Iterable<string>>;
  maxLength: number;
  methods: readonly string[];
  param: string;
  send: (method: string, path: string[]) => Promise<{ result: R } & PathReads>;
}): Promise<{
  classes: { method: string; path: string[]; result: R }[];
  trees: Map<string, SweepNode<R>>;
  sent: number;
}>;
/** The class a path falls in, or undefined for a path the sweep did not reach; see route-sweep.js. */
export declare function classOf<R>(
  trees: Map<string, SweepNode<R>>,
  method: string,
  path: readonly string[],
  param: string,
): SweepNode<R> | undefined;
/** `count` paths of the full product drawn by a fixed seed; see route-sweep.js. */
export declare function sampleMembers(options: {
  root: string;
  vocabulary: Map<number, Iterable<string>>;
  maxLength: number;
  param: string;
  count: number;
  seed?: number;
}): string[][];
