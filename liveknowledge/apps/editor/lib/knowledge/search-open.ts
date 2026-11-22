// Whether the knowledgebase's search dialog is open (docs/specs/030-knowledgebase/search-and-ask.md "Search"): one
// place every door asks (the field at the head of the page tree, Cmd or Ctrl K), outside React so a door needs no
// provider. Opening also says where to put the page once a result is chosen.
type Listener = () => void;

let open = false;
const listeners = new Set<Listener>();
const tell = () => {
  for (const listener of listeners) listener();
};

export const knowledgeSearch = {
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  isOpen: (): boolean => open,
  open: (): void => {
    if (open) return;
    open = true;
    tell();
  },
  close: (): void => {
    if (!open) return;
    open = false;
    tell();
  },
};

/** Whether a key press is the search chord: Cmd K on a Mac, Ctrl K elsewhere, nothing else held. */
export function isSearchChord(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): boolean {
  return (
    event.key.toLowerCase() === 'k' &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}
