// The host-facing types: what an app hands the Explorer so it can link, navigate and create without
// importing the app's router.

import type { ComponentType, MouseEventHandler, ReactNode } from 'react';
import type { App, InboxAction, InboxThread, Item, ShareLink } from '@liveworkspace/index-client';
import type { ShareHandOver } from './dialogs/share/handover';
import type { ShareHelpHref, ShareTelemetry } from './dialogs/share/types';

export type LinkProps = {
  href: string;
  className?: string;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  'aria-label'?: string;
  'aria-describedby'?: string;
  title?: string;
};

/** A link component, such as Next.js's `Link`. It must render an `<a>` and pass these props through. */
export type LinkComponent = ComponentType<LinkProps>;

/** What `itemHref` needs: the item, and how the person reaches it (`sharedVia` is its share code). */
export type ItemRef = Pick<Item, 'id' | 'app' | 'kind' | 'sharedVia'>;

/** A place inside an item, from an Inbox row: its tab and the element the comment or action is on, the popover to
 *  open there (the action's, or the comments'), and a card to open in the item's card panel (a card's row: the card
 *  sits on the board `elementId` names, or on no board when there is no tab). */
export type ItemPlace = {
  tabId?: string | null;
  elementId?: string | null;
  open?: 'action' | 'comments' | null;
  cardId?: string | null;
  // One of the card's comment threads, opened on the card.
  threadId?: string | null;
};

/** Where New should file the item, from the view it was pressed in. */
export type Placement = { folderId: string | null; teamId: string | null };

/** A team the person has joined (from their access token's `teams` claim; the index keeps no teams). */
export type TeamRef = { id: string; name: string };

export type ItemHref = (item: ItemRef, at?: ItemPlace) => string;
export type ShareUrl = (link: ShareLink, item: ItemRef) => string;
export type RenderThumbnail = (item: Item, size: 'row' | 'card') => ReactNode;

/** A host's own mark on an item, where rows, cards and the panel draw it: `title` beside the item's name (after its
 *  star), `time` beside its Updated time. livediagram's are a canvas's Google Drive sync and an unseen Drive
 *  folder. Called for every item drawn, so it returns quickly, and null for an item it has nothing to say about. */
export type RenderItemMark = (item: Item, at: 'title' | 'time') => ReactNode;

/** An app's logo, or the platform's for `'all'`: the filter's two choices wear them (the host owns the brands). */
export type RenderAppLogo = (app: App | 'all') => ReactNode;

/** What the Timeline reports, for the host's telemetry: a mode or filter changed (`Changed`, `Selected`), a page
 *  read (`Loaded`: More or Retry), a card, a stack or a card's menu opened (`Opened`), an entry or a stack taken
 *  off the reader's Timeline (`Removed`). `type` is always a fixed token. */
export type TimelineTelemetry = (
  action: 'Changed' | 'Selected' | 'Loaded' | 'Opened' | 'Removed',
  type: string,
) => void;

/** What Home's What Happened reports: an entry opened its item (`Selected`, `WhatHappened`), a summary dealt out
 *  (`Opened`, `Group`), See Timeline followed (`Selected`, `SeeTimeline`); and a failed read of Home retried
 *  (`Loaded`, `Retry`). */
export type HomeTelemetry = (action: 'Selected' | 'Opened' | 'Loaded', type: string) => void;

/** What the Explorer reports about keeping things in order, as `Category·Action`, the names the apps' own Explorers
 *  always sent:
 *  - `Folder·Created` (null, or `Team` in a team's library), `Folder·Renamed`, `Folder·Moved` (re-parented),
 *    `Folder·Deleted`;
 *  - `Folder·Changed` / `Folder·Cleared`: a default folder set or cleared, `Kind` for the app's own entry and
 *    `Template` for a template family's;
 *  - `Trash·Restored`, `Trash·Deleted` (for good), `Trash·Cleared` (emptied): `Personal` or `Team`, whose Trash;
 *  - `Team·Added` (an item moved into a team), `Team·Moved` (within one), `Team·Removed` (taken out to My Work).
 *  `app` is the app of the one item it acted on, or of the default folder's entry; without it the event counts
 *  for the page's app. */
export type OrganiseEvent =
  | 'Folder·Created'
  | 'Folder·Renamed'
  | 'Folder·Moved'
  | 'Folder·Deleted'
  | 'Folder·Changed'
  | 'Folder·Cleared'
  | 'Trash·Restored'
  | 'Trash·Deleted'
  | 'Trash·Cleared'
  | 'Team·Added'
  | 'Team·Moved'
  | 'Team·Removed';
export type OrganiseTelemetry = (event: OrganiseEvent, type: string | null, app?: App) => void;

/** A default folder's entry, as Folder·Changed / Cleared report it: the app's own kind, or a template family. */
export function placementDefaultTelemetry(key: string): 'Kind' | 'Template' {
  return key.includes(':template:') ? 'Template' : 'Kind';
}

/** An Inbox row the host read itself, marked `local`: from an item kept only in this browser, which the index never
 *  sees. Shown with the This Browser pill. */
export type Located<T> = T & { local?: true };

/** The host's own Inbox rows, read beside the index's each time the Inbox is read. */
export type InboxLocalRows = { actions: InboxAction[]; threads: InboxThread[] };

/** What the Inbox reports, for the host's telemetry: the Inbox opened (`Opened`, once a visit), a row followed
 *  into its app (`Selected`: Action, Card, Thread, CardThread or FormResponses), a failed read retried (`Loaded`,
 *  `Retry`), the filter bar changed (`Changed`: All, MyActions, AssignedByMe, Comments, FormResponses), and a verb
 *  carried out from the reading pane (`Added`: Reply; `Resolved`: Thread, Action or Card). */
export type InboxTelemetry = (
  action: 'Opened' | 'Selected' | 'Loaded' | 'Changed' | 'Added' | 'Resolved',
  type?: string,
) => void;

/** A row the reading pane acts on, as the host finds it in its app: an action, a card, an element's thread or a
 *  card's thread (`elementId` is the card's id for a card or a card's thread). `local` for an item only this
 *  browser holds. */
export type InboxTarget = {
  kind: 'Action' | 'Card' | 'Thread' | 'CardThread';
  app: App;
  itemId: string;
  tabId: string;
  elementId: string;
  actionId: string | null;
  local: boolean;
};

/** A verb the reading pane can offer: reply to a thread, resolve a thread, mark an action or a card done. */
export type InboxVerb = 'reply' | 'resolve' | 'done';

/** One comment of a thread, for the reading pane. */
export type InboxComment = {
  id: string;
  authorName: string | null;
  authorColor?: string;
  /** The author's person id, for their Google picture (from the Explorer's people store). */
  authorId?: string | null;
  /** The author's Google picture, where the host already has it. */
  authorPicture?: string | null;
  /** Written by the person reading. */
  mine?: boolean;
  text: string;
  at: number;
};

/** What the reading pane can do on this page, through the app's own code. Each verb is offered only where `offers`
 *  names it for the row, so a page never shows a button it can't carry out; Open in the app is always there. The
 *  calls resolve once the change is made (the row then leaves the list) and reject when it wasn't. */
export type InboxActions = {
  /** The verbs this page can carry out on the row, worked out without a request (it runs on every selection). */
  offers: (row: InboxTarget) => readonly InboxVerb[];
  reply?: (row: InboxTarget, text: string) => Promise<void>;
  resolve?: (row: InboxTarget) => Promise<void>;
  done?: (row: InboxTarget) => Promise<void>;
  /** The thread's comments, oldest first, when this page can read them; the pane asks once per thread, after the
   *  selection settles, and keeps the answer. Null (or no function) shows the latest comment the index holds. */
  loadThread?: (row: InboxTarget, signal: AbortSignal) => Promise<InboxComment[] | null>;
};

/** What the Inbox needs from the host beyond the index: its own items' rows, a card type's glyph, the help article
 *  on actions its empty state offers, and telemetry. Every member is optional. */
export type InboxHost = {
  /** Rows from items only this browser holds. A failure lists none; it never fails the Inbox. A different function
   *  (the host made again for someone else, once the person settles) is read again, so keep it stable between
   *  renders (memoise the host). */
  localRows?: () => Promise<InboxLocalRows>;
  /** Calls `onChange` when those rows may have changed, so the Inbox reads them again (the index's rows are kept).
   *  Returns the unsubscribe. */
  subscribeLocal?: (onChange: () => void) => () => void;
  /** A card's type glyph, by its type id; a plain card glyph otherwise. */
  cardGlyph?: (type: string) => ReactNode;
  actionsHelpHref?: string;
  onTelemetry?: InboxTelemetry;
  /** The reading pane's verbs this page can carry out (Reply, Resolve, Mark Done). Without it the pane offers Open
   *  in the app alone. */
  actions?: InboxActions;
};

/** What the Share dialog needs from the host beyond a link's address, per item, since the Explorer may list every
 *  app's items: the item's tabs (a link can open one), its embed and live image, help articles, and telemetry. */
export type ShareHost = {
  loadTabs?: (item: Item) => Promise<{ id: string; name: string }[]>;
  handOver?: (item: Item) => ShareHandOver | undefined;
  helpHref?: ShareHelpHref;
  onTelemetry?: ShareHostTelemetry;
};

/** The Share dialog's reports (ShareTelemetry), with the item it shares, so a host listing every app's items can
 *  count each under its own app. */
export type ShareHostTelemetry = (
  action: Parameters<ShareTelemetry>[0],
  type: string,
  item: Item,
) => void;

/** What a guest's sign-in banner reports, for the host's telemetry: Sign In followed (`Selected`), its reasons
 *  opened (`Opened`), the banner closed (`Closed`). `type` is a fixed token. */
export type SignInBannerTelemetry = (
  action: 'Selected' | 'Opened' | 'Closed',
  type: string,
) => void;

/** A guest's sign-in banner at the foot of the page: where its reasons' help article is, and telemetry. Signing in
 *  goes to the Explorer's `signInHref`. */
export type SignInBannerHost = {
  /** The help article on guests and accounts, linked from the reasons. */
  helpHref?: string;
  onTelemetry?: SignInBannerTelemetry;
};
