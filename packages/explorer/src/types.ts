// The host-facing types: what an app hands the Explorer so it can link, navigate and create without
// importing the app's router.

import type { ComponentType, MouseEventHandler, ReactNode } from 'react';
import type { Item, ShareLink } from '@liveworkspace/index-client';
import type { ShareHandOver } from './dialogs/share/handover';
import type { ShareHelpHref, ShareTelemetry } from './dialogs/share/types';

export type LinkProps = {
  href: string;
  className?: string;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  'aria-label'?: string;
  title?: string;
};

/** A link component, such as Next.js's `Link`. It must render an `<a>` and pass these props through. */
export type LinkComponent = ComponentType<LinkProps>;

/** What `itemHref` needs: the item, and how the person reaches it (`sharedVia` is its share code). */
export type ItemRef = Pick<Item, 'id' | 'app' | 'kind' | 'sharedVia'>;

/** A place inside an item, from an Inbox row: its tab and the element the comment or action is on. */
export type ItemPlace = { tabId?: string | null; elementId?: string | null };

/** Where New should file the item, from the view it was pressed in. */
export type Placement = { folderId: string | null; teamId: string | null };

/** A team the person has joined (from their access token's `teams` claim; the index keeps no teams). */
export type TeamRef = { id: string; name: string };

export type ItemHref = (item: ItemRef, at?: ItemPlace) => string;
export type ShareUrl = (link: ShareLink, item: ItemRef) => string;
export type RenderThumbnail = (item: Item, size: 'row' | 'card') => ReactNode;

/** What the Timeline reports, for the host's telemetry: a mode or filter changed (`Changed`, `Selected`), a page
 *  read (`Loaded`: More or Retry), a card, a stack or a card's menu opened (`Opened`), an entry or a stack taken
 *  off the reader's Timeline (`Removed`). `type` is always a fixed token. */
export type TimelineTelemetry = (
  action: 'Changed' | 'Selected' | 'Loaded' | 'Opened' | 'Removed',
  type: string,
) => void;

/** What Home's What Happened reports: an entry opened its item (`Selected`, `WhatHappened`), a summary dealt out
 *  (`Opened`, `Group`), See Timeline followed (`Selected`, `SeeTimeline`). */
export type HomeTelemetry = (action: 'Selected' | 'Opened', type: string) => void;

/** What the Share dialog needs from the host beyond a link's address, per item, since the Explorer may list every
 *  app's items: the item's tabs (a link can open one), its embed and live image, help articles, and telemetry. */
export type ShareHost = {
  loadTabs?: (item: Item) => Promise<{ id: string; name: string }[]>;
  handOver?: (item: Item) => ShareHandOver | undefined;
  helpHref?: ShareHelpHref;
  onTelemetry?: ShareTelemetry;
};
