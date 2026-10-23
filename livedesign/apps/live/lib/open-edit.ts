// The text edit open on the canvas (a label, a cell), for the unload flush (docs/specs/006-design/per-tab-storage.md
// "Saving"). An edit commits on blur, and closing or reloading the tab fires no blur the editor sees, so what was
// typed since the edit opened was never in the tabs the flush sends: a label typed and left open came back as its
// first letter. The open editor registers how it commits; the flush commits it before reading the tabs.

let commitOpen: (() => void) | null = null;

/** Registers the open edit's commit; returns the unregister, which only clears its own. */
export function registerOpenEdit(commit: () => void): () => void {
  commitOpen = commit;
  return () => {
    if (commitOpen === commit) commitOpen = null;
  };
}

/** Commits the open edit, if there is one. Called on the way out, before the tabs are read. */
export function commitOpenEdit(): void {
  commitOpen?.();
}
