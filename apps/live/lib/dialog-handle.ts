// A slot for an open dialog's own controls (its tabs, its close), registered while it is mounted, so an element tour
// that runs steps inside it from outside can drive it (docs/specs/007-editor/element-tours.md): the Sankey's Flows
// dialog, the Sequence dialog. A module slot: one editor per page, one such dialog open at a time.
export type DialogHandle<H> = {
  register: (next: H) => () => void;
  // The open dialog's handle, or null while it is closed.
  current: () => H | null;
};

export function createDialogHandle<H>(): DialogHandle<H> {
  let handle: H | null = null;
  return {
    register: (next) => {
      handle = next;
      return () => {
        if (handle === next) handle = null;
      };
    },
    current: () => handle,
  };
}
