// Whether a `pen` pointer has been used in this page session
// (docs/specs/023-whiteboard/whiteboard.md "Touch and pen input"). Module memory on purpose: the rule
// resets on reload, as Microsoft Whiteboard's does.
let seen = false;

export function markPenSeen(): void {
  seen = true;
}

export function penSeen(): boolean {
  return seen;
}

export function resetPenSeenForTests(): void {
  seen = false;
}
