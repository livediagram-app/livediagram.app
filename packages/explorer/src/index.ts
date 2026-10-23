// @liveworkspace/explorer: the One Explorer UI, built once and rendered by every app at its own /explorer
// (README.md). Small on purpose: the Explorer, its two dialogs a host may open on its own, the editor's
// panel, and the view helpers a host's router needs.

export { Explorer, type ExplorerProps } from './explorer/Explorer';
export {
  ExplorerPanel,
  type ExplorerPanelProps,
  type PanelLayout,
} from './panel/ExplorerPanel';
export { MoveToFolderDialog, type MoveToFolderDialogProps } from './dialogs/MoveToFolderDialog';
export type { PickerFolder, PickerTeam, Destination } from './dialogs/PlacementBrowser';
export { ShareDialog, type ShareDialogProps, type ShareTab } from './dialogs/ShareDialog';
export {
  explorerPath,
  viewFromLocation,
  DEFAULT_BASE_PATH,
  VIEW_TITLES,
  type ExplorerView,
  type ExplorerViewKind,
} from './views';
export { kindWords, heroWords, type AppFilter, type HeroWords, type Words } from './words';
export type { HelpHref } from './explorer/context';
export type {
  ItemHref,
  ItemPlace,
  ItemRef,
  LinkComponent,
  Placement,
  RenderThumbnail,
  ShareUrl,
  TeamRef,
  TimelineTelemetry,
} from './types';
