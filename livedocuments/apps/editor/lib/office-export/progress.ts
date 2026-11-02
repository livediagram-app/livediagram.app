// How an export reports and is stopped (docs/specs/020-import-export/blueprints/office-export.md "Behaviour and
// state"): a share done, a signal to cancel on, and a yield between the slow steps so the editor keeps answering.

export type ExportProgress = {
  /** The share done, 0 to 1. */
  onProgress?: (done: number) => void;
  signal?: AbortSignal;
};

/** Thrown when the export is cancelled: nothing downloads. */
export class ExportCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'ExportCancelled';
  }
}

export function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new ExportCancelled();
}

/** One macrotask: the browser paints the progress and handles input before the next slide or zone. */
export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
