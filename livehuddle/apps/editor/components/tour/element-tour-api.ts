// What an element tour's steps may do (docs/specs/007-editor/element-tours.md), built fresh by ElementTourHost every
// render on the element the tour is on. One facade for every toured kind.
export type ElementTourApi = {
  // Open the element's own menu (as More or a right-click does), or close it.
  openElementMenu: () => Promise<void>;
  closeElementMenu: () => void;
};
