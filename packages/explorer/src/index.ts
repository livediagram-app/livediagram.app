// @liveworkspace/explorer: the One Explorer UI, built once and rendered by every app at its own /explorer
// (README.md). Small on purpose: the Explorer, its two dialogs a host may open on its own, the editor's
// panel, and the view helpers a host's router needs.

export { Explorer, type ExplorerProps } from './explorer/Explorer';
export { ExplorerPanel, type ExplorerPanelProps, type PanelLayout } from './panel/ExplorerPanel';
export { MoveToFolderDialog, type MoveToFolderDialogProps } from './dialogs/MoveToFolderDialog';
export type { PickerFolder, PickerTeam, Destination } from './dialogs/PlacementBrowser';
export {
  ShareDialog,
  type ShareDialogProps,
  type ShareTab,
  type ShareHandOver,
  type ShareHelpArticle,
  type ShareHelpHref,
  type ShareIdentity,
  type ShareNotify,
  type ShareTelemetry,
} from './dialogs/ShareDialog';
export {
  explorerPath,
  viewFromLocation,
  DEFAULT_BASE_PATH,
  VIEW_TITLES,
  type ExplorerView,
  type ExplorerViewKind,
} from './views';
export { kindWords, heroWords, type AppFilter, type HeroWords, type Words } from './words';
export type { LensOption, LensTelemetryType } from './lens';
export type { NavigateOptions } from './explorer/context';
export type { HelpHref } from './explorer/context';
export type {
  ItemHref,
  ItemPlace,
  ItemRef,
  LinkComponent,
  Placement,
  RenderThumbnail,
  InboxHost,
  InboxLocalRows,
  InboxTelemetry,
  Located,
  ShareHost,
  ShareUrl,
  SignInBannerHost,
  SignInBannerTelemetry,
  TeamRef,
  TimelineTelemetry,
  HomeTelemetry,
} from './types';
export {
  DefaultFoldersSettings,
  type DefaultFoldersSettingsProps,
} from './defaults/DefaultFolders';
export { defaultEntries, type DefaultEntry } from './defaults/entries';
export {
  handTemplatePick,
  readTemplatePick,
  takeTemplatePick,
  moveOnTemplatePick,
  type TemplatePickHandoff,
} from './defaults/template-pick';
export type {
  WelcomeManifest,
  WelcomeOptions,
  WelcomeStart,
  WelcomeTelemetryType,
} from './welcome/types';
export type { SidebarLink } from './explorer/host';
export {
  createExplorerAccounts,
  AccountsError,
  PEOPLE_MAX,
  type ExplorerAccounts,
  type MyTeams,
  type PendingInvitation,
  type TeamDetails,
  type TeamMember,
  type TeamRole,
} from './data/accounts';
export type { ViewModeTelemetry } from './explorer/extras';
export { placeHash } from './place';
