// How the dashboard reads error events (spec/22), shared by the Exceptions
// tab and the Exceptions stack on Highlights so both split failures the same
// way.
//
// Types took their `<Kind>.<Where>` shape in #112; rows stored before that are
// the bare kind (`Http500`, `Internal`, `Uncaught`). The predicates below read
// the kind as the first dot-part, so both shapes land in the same card.

const kindOf = (type: string | null) => (type ?? '').split('.')[0] ?? '';

// Error·Client types that are not exceptions. RealtimeResync is the editor
// recovering on its own: the realtime room told it it had missed updates and
// it refetched (useRoomResync). Worth watching, since a lot of them means the
// room is dropping ops, but it is a recovery, not a crash, so it gets its own
// card instead of inflating Client Exceptions.
export const RECOVERY_TYPES: readonly string[] = ['RealtimeResync'];
export const isRecovery = (type: string | null) => RECOVERY_TYPES.includes(kindOf(type));

// The api worker's own crash report: `Internal.<Method>.<Route>`, where the
// second part is an HTTP method (apiRouteLabel). The MCP worker also reports
// `Internal.<Tool>` when its call to the api never completed; that is a
// request a caller saw fail, like the editor's Network kind, so it stays with
// the failed requests. A bare `Internal` predates #112 and is counted as a
// server crash, the api worker having been its main source.
const HTTP_METHODS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options']);
export function isServerCrash(type: string | null): boolean {
  const [kind, second] = (type ?? '').split('.');
  return kind === 'Internal' && (second === undefined || HTTP_METHODS.has(second));
}
