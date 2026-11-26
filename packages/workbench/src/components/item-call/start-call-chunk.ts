// The Start a Call popover's own chunk: loaded by ItemCallHost when it first opens, and asked for early when the
// pointer comes over Call or it takes focus, so the popover is usually there by the press.
export const loadStartCallPopover = () => import('./StartCallPopover');

/** Asks for the chunk; a failure is left for the open to meet (and retry). */
export const preloadStartCallPopover = (): void => {
  void loadStartCallPopover().catch(() => undefined);
};
