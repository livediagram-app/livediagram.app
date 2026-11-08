// The faces on a board take their finish together (docs/specs/008-canvas/finish.md "Performance"): Marker's and
// Sketch's pencil pass (useFaceFinishPass) and Sketch's ink copy (SketchFace). A take reads the face's layout and
// then writes into it; taken one face at a time, each face's writes made the next face's reads lay the board out
// again, once per face as a board of 2,000 faces mounted and again when its lettering loaded. Batched, every
// queued face clears first, then all are read, then all are written, so a batch lays the board out once.

/** One take of a face, split so a batch reads every face before it writes any. `prepare` makes the writes that
 *  must be in place before the face is read (clearing its last take); `read` measures and returns the writes; the
 *  writes may return what to do once every face is written (reading back what they set, in one style pass). */
export type FaceTake = {
  prepare?: () => void;
  read: () => () => void | (() => void);
};

/** When a queued take runs: `now` at the end of the current task (a face that mounts is drawn before it is first
 *  painted), `frame` at the next animation frame (a face that settled or whose lettering loaded). */
export type FaceTakeWhen = 'now' | 'frame';

/** A pass runs after the passes before it in the same batch: Sketch's ink copy (`copy`) is taken after the
 *  face's own pencil pass (`face`) has drawn, so the copy carries it. */
export type FaceTakeStage = 'face' | 'copy';

const STAGES: readonly FaceTakeStage[] = ['face', 'copy'];
const queued: Record<FaceTakeStage, Map<Element, FaceTake>> = { face: new Map(), copy: new Map() };
let microtask = false;
/** Cancels the pending frame's flush, when one is pending. */
let cancelFrame: (() => void) | null = null;

/** Queues `take` for `root` (replacing one already queued for it in the same stage). Returns the cancel. */
export function scheduleFaceTake(
  root: Element,
  take: FaceTake,
  when: FaceTakeWhen,
  stage: FaceTakeStage = 'face',
): () => void {
  queued[stage].set(root, take);
  if (when === 'now') {
    if (!microtask) {
      microtask = true;
      queueMicrotask(flushFaceTakes);
    }
  } else if (!cancelFrame) {
    if (typeof requestAnimationFrame === 'function') {
      const id = requestAnimationFrame(flushFaceTakes);
      cancelFrame = () => cancelAnimationFrame(id);
    } else {
      const id = setTimeout(flushFaceTakes, 16);
      cancelFrame = () => clearTimeout(id);
    }
  }
  return () => {
    if (queued[stage].get(root) === take) queued[stage].delete(root);
  };
}

/** Runs every queued take: per stage, all prepares, then all reads, then all writes, then all that follows the
 *  writes. A take that throws does not stop the others; the first error is thrown once the batch is done. */
export function flushFaceTakes(): void {
  microtask = false;
  cancelFrame?.();
  cancelFrame = null;
  const errors: unknown[] = [];
  const run = <T>(fn: () => T): T | undefined => {
    try {
      return fn();
    } catch (error) {
      errors.push(error);
      return undefined;
    }
  };
  for (const stage of STAGES) {
    const takes = [...queued[stage].values()];
    queued[stage].clear();
    for (const take of takes) if (take.prepare) run(take.prepare);
    const writes = takes.map((take) => run(take.read));
    const after = writes.map((write) => (write ? run(write) : undefined));
    for (const then of after) if (then) run(then);
  }
  if (errors.length > 0) throw errors[0];
}
