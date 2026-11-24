'use client';

import { useEffect, type ReactNode } from 'react';
import type { AppName } from '@liveworkspace/sites';
import { appFileUrl, type ResourceOption } from '../palette/element-resources';
import { ResourceLinkPanel } from './ResourceLinkPanel';
import { ResourcesDialog } from './ResourcesDialog';

// The Resources dialog for the element the menu's Resources row was pressed on (each editor's
// docs/specs/008-canvas/element-menu-quick-bar.md "Resources"): the options the menu's row counted, each run through
// the handlers the menu itself used. One copy for every editor: each hands in the element its menu's row took, its
// own quickBarItems, and (where elements take links) where its links go, from its components/dialogs/
// ElementResourcesDialog.tsx.

/** A link an element holds, as far as this reads it: its kind, and a web address, a tab or a file id by kind. */
type HeldLink = { kind: string };

/** A link picked in the dialog's own step: a web address, a tab, or one of this app's files (`<kind>Id`). */
export type PickedElementLink<K extends string> =
  | { kind: 'url'; url: string }
  | { kind: 'tab'; tabId: string }
  | ({ kind: K; name: string } & Record<`${K}Id`, string>);

/** Where an editor's element links go: the address, its tabs, its own files (as `kind`) and other apps' files. */
export type ElementResourcesLinks<K extends string> = {
  /** This app: its own files keep their own link kind; another product's file is linked by its address. */
  app: AppName;
  /** The link kind and link mode of this app's own files ('design', 'document', 'project'). */
  kind: K;
  /** The file being edited, which its own file list leaves out. */
  hostId: string;
  tabs: readonly { id: string; name: string }[];
  currentTabId: string;
  /** Sets the link on the selection (the menu that opened the dialog made the element the selection). */
  onLink: (link: PickedElementLink<K> | null) => void;
  /** The editor's telemetry `track`, called with the category spelled out so the telemetry scan reads each event. */
  track: (category: 'Element', action: 'Linked' | 'Unlinked', type?: string) => void;
};

/** What the dialog adds to the editor's quickBarItems: a link's removal, its tabs and its places' steps. */
export type ElementResourcesLinkParts = {
  onRemoveLink: () => void;
  tabs: readonly { id: string; name: string }[];
  linkPanel: (mode: string, done: () => void) => ReactNode;
};

const stringAt = (link: HeldLink | undefined, key: string): string | undefined => {
  const value = (link as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' ? value : undefined;
};

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

function linkParts<K extends string>(
  links: ElementResourcesLinks<K>,
  link: HeldLink | undefined,
): ElementResourcesLinkParts {
  return {
    onRemoveLink: () => {
      links.onLink(null);
      links.track('Element', 'Unlinked');
    },
    tabs: links.tabs,
    // A link's place is a step of this dialog, not a dialog of its own: the address, the tabs, the files.
    linkPanel: (mode, done) => {
      // This app's own file keeps its own link kind; another product's is linked by its address.
      const app =
        mode === 'url' || mode === 'tab'
          ? null
          : mode === links.kind
            ? links.app
            : (mode.slice(4) as AppName);
      return (
        <ResourceLinkPanel
          mode={app ? { app } : (mode as 'url' | 'tab')}
          current={{
            url: link?.kind === 'url' ? stringAt(link, 'url') : undefined,
            tabId:
              link?.kind === 'tab' || link?.kind === 'element'
                ? stringAt(link, 'tabId')
                : undefined,
            fileId: link?.kind === links.kind ? stringAt(link, `${links.kind}Id`) : undefined,
          }}
          tabs={links.tabs}
          currentTabId={links.currentTabId}
          hostId={links.hostId}
          onPick={(pick) => {
            links.onLink(
              pick.kind !== 'file'
                ? pick
                : pick.app === links.app
                  ? ({
                      kind: links.kind,
                      [`${links.kind}Id`]: pick.id,
                      name: pick.name,
                    } as PickedElementLink<K>)
                  : { kind: 'url', url: appFileUrl(pick.app, pick.id) },
            );
            links.track(
              'Element',
              'Linked',
              pick.kind === 'url'
                ? 'Url'
                : pick.kind === 'tab'
                  ? 'Tab'
                  : pick.app === links.app
                    ? capitalised(links.kind)
                    : 'App',
            );
            done();
          }}
        />
      );
    },
  };
}

export function ElementResourcesDialog<T extends { link?: HeldLink }, K extends string>({
  openId,
  target,
  name,
  options,
  links,
  onClose,
}: {
  /** The element the dialog was opened for, by id. */
  openId: string | null;
  /** That element, when it is on the active tab and takes what the menu's row took (a boxed element). */
  target: T | undefined;
  /** The element's kind, for the dialog's header. */
  name: (target: T) => string;
  /** The editor's quickBarItems for the element, given the link parts when the editor takes links. */
  options: (target: T, links: ElementResourcesLinkParts | undefined) => readonly ResourceOption[];
  /** Where links go, in an editor whose elements take them. */
  links?: ElementResourcesLinks<K>;
  onClose: () => void;
}) {
  // Its element gone (deleted, undone away, on another tab): closed, never left to reopen by itself.
  const gone = openId !== null && !target;
  useEffect(() => {
    if (gone) onClose();
  }, [gone, onClose]);
  if (!target) return null;
  const list = options(target, links ? linkParts(links, target.link) : undefined);
  if (!list.length) return null;
  return <ResourcesDialog elementName={name(target)} options={list} onClose={onClose} />;
}
