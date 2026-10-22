// A request to open the Toolbar strip's Search (docs/specs/007-editor/toolbar-layout.md "Search:
// every element type"): the S key asks; the strip answers when it is showing a Search (Toolbar
// layout, an editor, not an event-storming board, the chrome not hidden). Whether anyone answered
// is returned, so the key can fall back to its old meaning (Select) where there is no Search.
type Listener = () => void;
const listeners = new Set<Listener>();

export function requestToolbarSearch(): boolean {
  for (const l of listeners) l();
  return listeners.size > 0;
}

export function onToolbarSearchRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
