// @liveworkspace/explorer: the One Explorer UI, built once and rendered by every app at its own /explorer
// (README.md). Small on purpose: the Explorer, its two dialogs a host may open on its own, the editor's
// panel, and the view helpers a host's router needs.

export { Explorer, type ExplorerProps } from './explorer/Explorer';
export { ExplorerPanel, type ExplorerPanelProps } from './panel/ExplorerPanel';
export { MoveToFolderDialog, type MoveToFolderDialogProps } from './dialogs/MoveToFolderDialog';
export type { PickerFolder, PickerTeam, Destination } from './dialogs/PlacementBrowser';
export { ShareDialog, type ShareDialogProps, type ShareTab } from './dialogs/ShareDialog';
export {
  explorerPath,
  viewFromLocation,
  DEFAULT_BASE_PATH,
  type ExplorerView,
  type ExplorerViewKind,
} from './views';
export { kindWords, type AppFilter, type Words } from './words';
export type {
  ItemHref,
  ItemPlace,
  ItemRef,
  LinkComponent,
  Placement,
  RenderThumbnail,
  ShareUrl,
  TeamRef,
} from './types';
