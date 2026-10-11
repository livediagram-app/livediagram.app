// A pointer drag followed on the window, as the plan views' drags (Gantt bars, Gantt rows, the names column, calendar
// cards) all follow theirs: every move goes to `onMove`, then `onEnd` runs once, committed on the release and not on
// a pointercancel or Escape. Escape is heard in the capture phase and swallowed, so a menu or dialog round the drag
// stays open. The returned stop ends the drag uncommitted (an unmount, or a new drag starting).
export function followWindowDrag(
  onMove: (e: PointerEvent) => void,
  onEnd: (commit: boolean) => void,
): () => void {
  let ended = false;
  const end = (commit: boolean) => {
    if (ended) return;
    ended = true;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey, true);
    onEnd(commit);
  };
  const onUp = () => end(true);
  const onCancel = () => end(false);
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    end(false);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey, true);
  return () => end(false);
}
