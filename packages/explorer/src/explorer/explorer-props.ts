// What a host hands <Explorer> (Explorer.tsx), which re-exports the type.

import { type ReactNode } from 'react';
import type { App, IndexClient, Item } from '@liveworkspace/index-client';
import type { LibraryHostProps } from '../library/types';
import { type ExplorerView } from '../views';
import type { AppFilter, HeroWords } from '../words';
import type {
  ItemHref,
  LinkComponent,
  Placement,
  RenderAppLogo,
  RenderItemMark,
  RenderThumbnail,
  InboxHost,
  ShareHost,
  SignInBannerHost,
  ShareUrl,
  TeamRef,
  HomeTelemetry,
  OrganiseTelemetry,
} from '../types';
import type { LensOption, LensTelemetryType } from '../lens';
import type { DefaultFolderOption } from '../defaults/entries';
import { type HelpHref, type FolderShown, type NavigateOptions } from './context';
import { type SidebarLink } from './host';
import { type ThisBrowserHost } from './ThisBrowser';
import { type TemplateHref } from '../hero/WorkKinds';
import type { WelcomeOptions } from '../welcome/types';
import { type ViewModeTelemetry } from './extras';
import type { ExplorerAccounts } from '../data/accounts';
import type { TeamsHost } from '../data/teams';
import { type ExplorerDriveHost } from '../drive/useDriveMarks';

export type ExplorerProps = {
  /** The host app: its kind is what New makes and what "this app" shows. */
  app: App;
  client: IndexClient;
  view: ExplorerView;
  /** Go to another view; `href` is its address under `basePath`. `replace`: replace the history entry rather
   *  than add one (the filter field's writes, at most every 250 ms while typing). */
  onNavigate: (view: ExplorerView, href: string, options?: NavigateOptions) => void;
  /** An item's address in its own app (another app's item opens there), optionally at a tab and element. */
  itemHref: ItemHref;
  /** New: make an item of this app's kind (or `app`'s, one of `newApps`) at this placement, then open it. */
  onCreate: (placement: Placement, app?: App) => void;
  /** Where the list can show every app (the All filter): the apps New offers, as a choice. Without it, or with
   *  one app, New makes this app's kind. */
  newApps?: readonly App[];
  /** A preview for a row (small) or a card (large); without it rows show the kind's icon. */
  renderThumbnail?: RenderThumbnail;
  /** The host's own marks on an item, beside its name and its Updated time (RenderItemMark). */
  renderItemMark?: RenderItemMark;
  /** Google Drive's marks and reconnect banner (liveworkspace/docs/specs/005-drive/drive.md "The Explorer shows each item's sync"):
   *  the Drive service over the host's origin, for a signed-in person. Without it, or for someone not connected,
   *  nothing shows and only the config is read. */
  drive?: ExplorerDriveHost | null;
  /** The filter's logos: the app's, and the platform's for All (RenderAppLogo). */
  renderAppLogo?: RenderAppLogo;
  /** The host's link component (Next.js `Link`); a plain `<a>` by default. */
  Link?: LinkComponent;
  /** Opens an item from a menu; a page load by default. */
  onOpenItem?: (href: string, item: Item) => void;
  /** Where the Explorer lives in the host, `/explorer` by default. */
  basePath?: string;
  /** Teams the person has joined (their token's `teams` claim), for the sidebar and Move. */
  teams?: TeamRef[];
  /** Making and running teams in place (createTeamsHost; packages/explorer/README.md "Teams"): New Team, the team
   *  card, and answering invitations. Without it teams show, but nothing about them changes here. */
  teamsHost?: TeamsHost | null;
  /** The person's id, for "Assigned to You" in the Inbox. */
  viewerId?: string | null;
  /** A share link's address; `${origin}/s/<code>` by default. */
  shareUrl?: ShareUrl;
  /** The Share dialog's extras, per item: its tabs (a link can open one), its embed and live image, help articles and
   *  telemetry. */
  share?: ShareHost;
  /** The Inbox's extras: rows from items only this browser holds, card glyphs, a help article and telemetry. */
  inbox?: InboxHost;
  /** Controlled filter; uncontrolled (remembered per app in this browser) when omitted. */
  filter?: AppFilter;
  onFilterChange?: (filter: AppFilter) => void;
  /** Rendered beside the search field (the host's own controls). */
  toolbar?: ReactNode;
  /** The host's top bar, given the search field to set in it (null while Home's hero holds the field).
   *  Without it the Explorer draws a slim bar of its own with the field in the middle. */
  header?: (parts: { search: ReactNode }) => ReactNode;
  /** Where Home's hero starts a kind of work: the app's New route with the template (`/new?template=`), or null for
   *  no link. By default the host app's own `/new?template=<template>` on this origin, and another app's on that
   *  app's site. */
  templateHref?: TemplateHref;
  /** The hero's question and lead; each app's kind has its own by default. */
  heroWords?: HeroWords;
  /** Controlled: whether the person hid Home's hero (a synced setting). Uncontrolled (remembered in this
   *  browser) when omitted. */
  heroHidden?: boolean;
  /** Called when the person hides the hero with its close. */
  onHideHero?: () => void;
  /** A view's help article; a Help button shows in its header (and Home's hero) when there is one. */
  helpHref?: HelpHref;
  /** An item the host trashed just before landing here (the plan open in its editor): the Explorer says so, once,
   *  with an Undo that restores it and re-reads the lists. */
  trashedOnArrival?: { id: string; title: string | null } | null;
  /** The item an editor's door came from (`?item=`), once the host has opened the place that holds it: its row or
   *  card is scrolled into view and marked (one-explorer.md "Opening from an open item"). */
  arrivedItem?: string | null;
  /** Home's reports (a failed read retried, a card or See More followed), for the host's telemetry. */
  onHome?: HomeTelemetry;
  /** Folders made, moved and deleted, default folders set and cleared, the Trash restored from, deleted from and
   *  emptied, and items moved into, within and out of a team (OrganiseTelemetry), for the host's telemetry. */
  onOrganise?: OrganiseTelemetry;
  /** The filter lens's Template values: the host app's template families, matched against the last word of each
   *  item's creation intent. Without them there is no Template filter. */
  lensTemplates?: readonly LensOption[];
  /** The filter lens's Mode values: the host app's editor modes (livediagram's Diagram, Draw and Workshop), matched
   *  against the mode each item's summary reports. Without them there is no Mode filter. */
  lensModes?: readonly LensOption[];
  /** Default Folders' entries for what the host's items open in and the kinds of their first tabs (livediagram's
   *  Diagrams, Drawings, Workshops), between the app's own and its templates'. A mode-only app (index-client
   *  filesByModeOnly) lists these alone. */
  defaultFolderOptions?: readonly DefaultFolderOption[];
  /** The folder on screen, once its list is in: its name and how many items sit directly in it (FolderShown). */
  onFolderShown?: (shown: FolderShown) => void;
  /** A facet of the filter lens gained a value (`Explorer / Selected / <Facet>`), for the host's telemetry. */
  onLensSelected?: (type: LensTelemetryType) => void;
  /** Home's first run: for a person with nothing yet, the app's starting points in place of empty lists, and the
   *  hero's welcome. Without it Home shows its empty sections. */
  welcome?: WelcomeOptions;
  /** The host's own rows in the sidebar's More group, after the Library (liveworkspace.app's This Browser link). */
  sidebarLinks?: readonly SidebarLink[];
  /** The host app's items kept only in this browser, where the host can read them (the Explorer on the app's own
   *  address): This Browser's Space in the sidebar (with its local folders), `/explorer/offline`, Home's tile, a
   *  Trash group and Most Used and Recent. */
  thisBrowser?: ThisBrowserHost | null;
  /** The filter's every-app choice, "All" by default ("All apps" where the Explorer is no one app's). */
  allLabel?: string;
  /** Whether the "<app> | All" switch shows. False where the Explorer is in no app (liveworkspace.app reached from
   *  no app): `filter` stays the host's, and there is no app to switch to. Shown when omitted. */
  showAppFilter?: boolean;
  /** A sentence said once on arrival, as a toast (why the person was sent here: a revoked link, say). */
  arrivalNotice?: string | null;
  /** liveworkspace accounts, for people's names (the Owner column, the Inbox, History: one cache). On
   *  liveworkspace.app: `createExplorerAccounts()`. Without it those go unsaid. */
  accounts?: ExplorerAccounts | null;
  /** Whether the person is signed in; a guest is nudged to sign in for Teams. Signed in when omitted. */
  signedIn?: boolean;
  /** Where a guest signs in (the Teams nudge, and the banner). */
  signInHref?: string;
  /** A guest's sign-in banner at the foot of the page (Sign In, the reasons, a close this browser remembers), shown
   *  while `signedIn` is false and there is a `signInHref`. Without it there is no banner. */
  signInBanner?: SignInBannerHost;
  /** Loads an item's preview ahead, as its Details row comes near the screen (the hover preview then paints at
   *  once). */
  prefetchThumbnail?: (item: Item) => void;
  /** The List / Card / Details toggle switched (`UI / Toggled / <type>`), for the host's telemetry. */
  onViewToggled?: (type: ViewModeTelemetry) => void;
} & LibraryHostProps;
