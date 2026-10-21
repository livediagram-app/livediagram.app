import util from 'node:util';

// tfjs-node 4.22 still calls `util.isNullOrUndefined` and `util.isArray`,
// which Node 23 removed. Restored here before tfjs-node is first imported.
const legacy = util as unknown as Record<string, unknown>;
legacy.isNullOrUndefined ??= (v: unknown) => v === null || v === undefined;
legacy.isArray ??= Array.isArray;
