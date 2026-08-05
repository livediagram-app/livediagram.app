// Did the server accept it?
//
// The optimistic list actions (spec/15, spec/35) all share a shape: update the
// row locally so the UI feels instant, fire the request, and reconcile later.
// Several of them spelled the "reconcile later" part `await apiThing(…).catch(()
// => {})` and then carried straight on — which reads as "ignore the failure"
// but actually means "treat every failure as a success", because the next
// statement runs either way. That was fine for a follow-up refresh, and wrong
// for anything that records or reports an outcome: a rename the server refused
// was rolled back on screen and still counted as a rename.
//
// So: turn the rejection into a value the caller has to look at.
//
//   if (await accepted(apiUpdateFolder(ownerId, id, { name }))) track(…);
//
// Deliberately NOT a wrapper around `track` itself. The telemetry-coverage
// guard (lib/telemetry-coverage.test.ts) finds emitted events by scanning the
// source for literal track() call sites and reading their first two arguments,
// so hiding emits inside a helper would make them invisible to the check that
// exists to stop telemetry drifting silently — the exact failure it was written
// for. (That scan is also why this paragraph spells the call without quoted
// argument literals: it reads comments too, and a realistic-looking example
// would register as a real emit.)
export function accepted(request: Promise<unknown>): Promise<boolean> {
  return request.then(() => true).catch(() => false);
}
