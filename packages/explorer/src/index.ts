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
  type ShareView,
  type ShareHandOver,
  type ShareHelpArticle,
  type ShareHelpHref,
  type ShareIdentity,
  type ShareNotify,
  type ShareTelemetry,
} from './dialogs/ShareDialog';
export { SECTION_LABEL as SHARE_SECTION_LABEL } from './dialogs/share/parts';
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
export type { FolderShown, NavigateOptions } from './explorer/context';
export type { HelpHref } from './explorer/context';
export type {
  ItemHref,
  ItemPlace,
  ItemRef,
  LinkComponent,
  Placement,
  RenderAppLogo,
  RenderItemMark,
  RenderThumbnail,
  InboxHost,
  InboxLocalRows,
  InboxTelemetry,
  Located,
  ShareHost,
  ShareHostTelemetry,
  ShareUrl,
  SignInBannerHost,
  SignInBannerTelemetry,
  TeamRef,
  TimelineTelemetry,
  HomeTelemetry,
  OrganiseEvent,
  OrganiseTelemetry,
} from './types';
export { placementDefaultTelemetry } from './types';
export {
  DRIVE_MARKS_MIN_GAP_MS,
  type DriveMarksClient,
  type ExplorerDriveHost,
} from './drive/useDriveMarks';
export {
  DefaultFoldersSettings,
  type DefaultFoldersSettingsProps,
} from './defaults/DefaultFolders';
export { defaultEntries, type DefaultEntry, type DefaultFolderOption } from './defaults/entries';
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
export { useThisBrowserList, type ThisBrowserHost } from './explorer/ThisBrowser';
export type { ThisBrowserItem } from './this-browser';
export { WorkKinds, defaultTemplateHref, type TemplateHref } from './hero/WorkKinds';
export { WORK_KINDS, workTiles, type WorkKind, type WorkTile } from './hero/work-kinds';
export {
  createExplorerAccounts,
  AccountsError,
  PEOPLE_MAX,
  type ExplorerAccounts,
} from './data/accounts';
export {
  createTeamsHost,
  teamErrorMessage,
  TeamsError,
  type AnsweredInvitation,
  type InviteLink,
  type MyTeams,
  type PendingInvitation,
  type RemovedMember,
  type TeamDetails,
  type TeamMember,
  type TeamResult,
  type TeamRole,
  type TeamsHost,
  type TeamsHostOptions,
} from './data/teams';
export type { ViewModeTelemetry } from './explorer/extras';
export { placeHash } from './place';
export type {
  GalleryHost,
  GalleryImage,
  GalleryUse,
  ImportHost,
  ImportSource,
  ItemMenuHost,
  ItemMenuVerb,
  LibraryHostProps,
  LibraryShape,
  RenameResult,
  ShapeLibrariesHost,
  ShapeLibrary,
} from './library/types';
export { appLibraryHosts, uploadRefusal, type AppLibraryHosts } from './library/http';
