// The Overview's preview queue (docs/specs/026-plan/plan-overview.md "Performance"): tiles that come near the screen
// together start their previews one per animation frame, so opening a plan of many tabs is a run of short tasks,
// never one long one.
type Start = () => void;

const waiting: Start[] = [];
let frame: number | null = null;

function next() {
  frame = null;
  const start = waiting.shift();
  start?.();
  if (waiting.length > 0) frame = requestAnimationFrame(next);
}

// Queues `start`; the answer takes it back out (a tile unmounted before its turn).
export function queuePreview(start: Start): () => void {
  waiting.push(start);
  if (frame === null) frame = requestAnimationFrame(next);
  return () => {
    const at = waiting.indexOf(start);
    if (at >= 0) waiting.splice(at, 1);
  };
}
