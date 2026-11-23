'use client';

// What attaches to an element (each product's docs/specs/008-canvas/element-menu-quick-bar.md "Resources"): its
// Action, Comments, Link and Note, whichever the app offers. Built once here for every editor: the element menu
// reads the list to know whether to draw its Resources row, and the Resources dialog draws it. An option is offered
// when its handler is given, so an app without comments (or links, or notes) leaves that handler out.
import type { ReactNode } from 'react';
import { BrandMark } from '@liveworkspace/brand';
import { APP_ITEMS, APP_NAMES, siteOfApp, type AppName } from '@liveworkspace/sites';
import { Glyph, lucideGlyph } from '@liveworkspace/ui';
import {
  lucideFileText,
  lucideGlobe,
  lucidePanelTop,
  lucidePencil,
  lucideTrash2,
  lucideUnlink,
} from '@liveworkspace/icons/lucide';
import { ActionMenuIcon, CommentMenuIcon, NoteMenuIcon } from './context-menu-icons';
import { LinkMenuIcon, MENU_ICON_PX } from './menu-icon-base';

const WebGlyph = lucideGlyph(lucideGlobe, MENU_ICON_PX);
const TabGlyph = lucideGlyph(lucidePanelTop, MENU_ICON_PX);
const FileGlyph = lucideGlyph(lucideFileText, MENU_ICON_PX);
const EditGlyph = lucideGlyph(lucidePencil, MENU_ICON_PX);
const UnlinkGlyph = lucideGlyph(lucideUnlink, MENU_ICON_PX);
const RemoveGlyph = lucideGlyph(lucideTrash2, MENU_ICON_PX);

/** One of an option's own options, on its screen in the Resources dialog. */
export type ResourceChoice = {
  key: string;
  label: string;
  // Its short name on its own step's back bar, where the full one says more than the bar needs ("Knowledgebase",
  // not "liveknowledge Knowledgebase").
  crumb?: string;
  // The name as it is drawn, where it is more than its words (a product's wordmark); `label` stays its name.
  title?: ReactNode;
  // The line under the name.
  detail: string;
  icon: ReactNode;
  // The one the element has now (the kind of place its link goes to): it wears a "Current" badge.
  current?: boolean;
  // Takes the resource off the element. It runs inside the dialog, which then goes back to its list; every other
  // choice opens another surface, so the dialog closes first.
  removes?: boolean;
  run: () => void;
  // Its own step inside the dialog (a link's place: the address field, the tabs, the files), under a back bar. It
  // is told how to say it is done. With one, the choice opens the step and `run` is not called.
  panel?: (done: () => void) => ReactNode;
};

/** One thing that attaches to an element: a row of the Resources dialog's first screen. */
export type ResourceOption = {
  key: string;
  // What it is, as its row and its screen are named: "Link".
  name: string;
  // The verb, as the row acts: "Add Link", or "Edit Link" once it has one.
  label: string;
  icon: ReactNode;
  // Whether the element already has one.
  on: boolean;
  // One line saying what it is.
  detail: string;
  // What the element has now: the link's destination, "2 comments", "No note yet".
  state: string;
  // The whole of what it holds, where the state line is only its start (a note's words).
  preview?: string;
  // What the row does when it has no options of its own: it opens the option's own surface.
  run: () => void;
  // Its own surface is a dialog, which then draws inside the Resources dialog as a screen of it (under a back bar)
  // rather than as a second dialog over it (the dialog slot, as Tools hosts a tool).
  inline?: boolean;
  // Its own options. With any, the row opens a screen of them inside the dialog instead of running.
  choices?: ResourceChoice[];
};

/** The glyph on the menu's Resources row: a paperclip, for what is attached to the element. */
export function ResourcesMenuGlyph() {
  return (
    <Glyph size={14}>
      <path d="M13 7.5 8.2 12.3a3.2 3.2 0 0 1-4.5-4.5l5-5a2.1 2.1 0 0 1 3 3l-5 5a1.1 1.1 0 0 1-1.5-1.5L9.7 4.8" />
    </Glyph>
  );
}

/** A place a link can go to. `kinds` are the link kinds it holds; `app` is the product whose files it lists. */
export type ResourceLinkMode<M extends string> = {
  mode: M;
  label: string;
  detail: string;
  kinds: readonly string[];
  app?: AppName;
  // Another product's file is linked by its address, which starts with this.
  urlPrefix?: string;
};

/** Where a file of `app` opens: the link another product's element carries to it. */
export const appFileUrl = (app: AppName, id: string): string =>
  `${siteOfApp(app).url}${APP_ITEMS[app].itemPath}${encodeURIComponent(id)}`;

/** The mode that lists another product's files. */
export type AppLinkMode = `app:${AppName}`;

/**
 * A link's places: a web address, a tab, then a file of each product (this app's first), each named by the product
 * and what it calls its file: "livediagram Canvas", "liveplanner Plan". This app's own file keeps its own link kind
 * (`fileMode`); another product's is linked by its address.
 */
export function appLinkModes<M extends string>(
  here: AppName,
  fileMode: M,
): ResourceLinkMode<'url' | 'tab' | M | AppLinkMode>[] {
  const apps = [here, ...APP_NAMES.filter((app) => app !== here)];
  return [
    { mode: 'url', label: 'External URL', detail: 'A page on the web', kinds: ['url'] },
    {
      mode: 'tab',
      label: 'Tab',
      detail: 'A tab or an element',
      kinds: ['tab', 'element'],
    },
    ...apps.map((app): ResourceLinkMode<M | AppLinkMode> => {
      const { noun } = APP_ITEMS[app];
      // What the product calls its file, under its wordmark.
      const detail = noun;
      return app === here
        ? { mode: fileMode, label: `${app} ${noun}`, detail, kinds: [fileMode], app }
        : {
            mode: `app:${app}`,
            label: `${app} ${noun}`,
            detail,
            kinds: [],
            app,
            urlPrefix: `${siteOfApp(app).url}${APP_ITEMS[app].itemPath}`,
          };
    }),
  ];
}

// A product's file as a choice is named by the product's wordmark ("live" light, its word strong); what it calls
// a file is the line under it.
function AppFileTitle({ app }: { app: AppName }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="tracking-tight">
        <span className="font-normal text-slate-500 dark:text-slate-400">live</span>
        {app.replace(/^live/, '')}
      </span>
    </span>
  );
}

/** Where a link goes, in a line: a web address without its scheme, a tab by name, a file by name. */
export function describeElementLink(
  link: unknown,
  tabs: readonly { id: string; name: string }[] = [],
): string {
  const l = (link ?? {}) as { kind?: string; url?: string; tabId?: string; name?: string };
  if (l.kind === 'url' && l.url) return l.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const tab = tabs.find((t) => t.id === l.tabId)?.name;
  if (l.kind === 'tab') return tab ? `Tab: ${tab}` : 'A tab';
  if (l.kind === 'element') return tab ? `An element on ${tab}` : 'An element on a tab';
  if (typeof l.name === 'string' && l.name.trim()) return l.name;
  return 'Linked';
}

/** The parts of an element the options read. Every editor's boxed element fits. */
export type ResourceTarget = {
  id: string;
  type: string;
  action?: { name: string; status?: string };
  link?: unknown;
  note?: string;
  commentThread?: { comments: readonly unknown[] };
};

export type ResourceHandlers<M extends string> = {
  onAssignAction?: (elementId: string) => void;
  onOpenComments?: (elementId: string) => void;
  onLinkElement?: (elementId: string, mode?: M) => void;
  onOpenNote?: (elementId: string) => void;
  // Takes the link off the selected element, which the menu's target is.
  onRemoveLink?: () => void;
  onRemoveNote?: (elementId: string) => void;
  // The link picker's places. Without them the Link row opens the picker as it stands.
  linkModes?: readonly ResourceLinkMode<M>[];
  // A place's own step, drawn inside the dialog (ResourceLinkPanel): absent, the place opens the link picker.
  linkPanel?: (mode: M, done: () => void) => ReactNode;
  // The tabs a link may name, so a linked tab reads by its name.
  tabs?: readonly { id: string; name: string }[];
};

const ACTION_STATE: Record<string, string> = { done: 'Done: ', 'wont-do': "Won't Do: " };

/**
 * The options offered on `target`, in order. A link card and a video take their link from their own Link category,
 * so Link is not offered on them.
 */
export function elementResourceOptions<M extends string>(
  target: ResourceTarget,
  h: ResourceHandlers<M>,
): ResourceOption[] {
  const { id } = target;
  const options: ResourceOption[] = [];

  const { onAssignAction } = h;
  if (onAssignAction) {
    const action = target.action;
    options.push({
      key: 'action',
      name: 'Action',
      label: action ? 'View Action' : 'Assign Action',
      icon: <ActionMenuIcon />,
      on: !!action,
      detail: 'Work assigned to someone',
      inline: true,
      state: action ? `${ACTION_STATE[action.status ?? ''] ?? ''}${action.name}` : 'No action yet',
      run: () => onAssignAction(id),
    });
  }

  const { onOpenComments } = h;
  if (onOpenComments) {
    const count = target.commentThread?.comments.length ?? 0;
    options.push({
      key: 'comment',
      name: 'Comments',
      label: count ? 'View Comments' : 'Add Comment',
      icon: <CommentMenuIcon />,
      on: count > 0,
      detail: 'A thread to talk it over',
      state: count ? `${count} ${count === 1 ? 'comment' : 'comments'}` : 'No comments yet',
      run: () => onOpenComments(id),
    });
  }

  const { onLinkElement } = h;
  if (onLinkElement && target.type !== 'link-card' && target.type !== 'video') {
    const link = target.link;
    const kind = (link as { kind?: string } | undefined)?.kind;
    const modes = h.linkModes ?? [];
    const choices: ResourceChoice[] = [];
    // A link of a kind no place here names (a screen of a prototype) is still edited where it was made.
    if (
      link &&
      !modes.some(
        (m) =>
          (kind !== undefined && m.kinds.includes(kind)) ||
          (kind === 'url' &&
            !!m.urlPrefix &&
            !!(link as { url?: string }).url?.startsWith(m.urlPrefix)),
      )
    )
      choices.push({
        key: 'edit',
        label: 'Edit Link',
        detail: 'Change where it goes',
        icon: <EditGlyph />,
        run: () => onLinkElement(id),
      });
    // A link to another product's file is a web address that starts with that product's files' address.
    const url = (link as { url?: string } | undefined)?.url;
    const byAddress = modes.find(
      (m) => kind === 'url' && !!m.urlPrefix && !!url?.startsWith(m.urlPrefix),
    );
    for (const m of modes)
      choices.push({
        key: m.mode,
        label: m.label,
        ...(m.app ? { title: <AppFileTitle app={m.app} />, crumb: APP_ITEMS[m.app].noun } : {}),
        detail: m.detail,
        icon: m.app ? (
          <BrandMark app={m.app} className="size-5" />
        ) : m.mode === 'url' ? (
          <WebGlyph />
        ) : m.mode === 'tab' ? (
          <TabGlyph />
        ) : (
          <FileGlyph />
        ),
        current: byAddress
          ? m === byAddress
          : !!link && kind !== undefined && m.kinds.includes(kind),
        run: () => onLinkElement(id, m.mode),
        ...(h.linkPanel ? { panel: (done: () => void) => h.linkPanel!(m.mode, done) } : {}),
      });
    const { onRemoveLink } = h;
    if (link && onRemoveLink && modes.length)
      choices.push({
        key: 'remove',
        label: 'Remove Link',
        detail: 'A click on it opens nothing again',
        icon: <UnlinkGlyph />,
        removes: true,
        run: onRemoveLink,
      });
    options.push({
      key: 'link',
      name: 'Link',
      label: link ? 'Edit Link' : 'Add Link',
      icon: <LinkMenuIcon />,
      on: !!link,
      detail: 'A page or tab it opens',
      state: link ? describeElementLink(link, h.tabs) : 'No link yet',
      run: () => onLinkElement(id),
      choices: choices.length ? choices : undefined,
    });
  }

  const { onOpenNote } = h;
  if (onOpenNote) {
    const note = target.note?.trim() ?? '';
    const { onRemoveNote } = h;
    options.push({
      key: 'note',
      name: 'Note',
      label: note ? 'Edit Note' : 'Add Note',
      icon: <NoteMenuIcon />,
      on: !!note,
      detail: 'Words kept behind it',
      state: note ? (note.split('\n')[0] ?? note) : 'No note yet',
      preview: note || undefined,
      run: () => onOpenNote(id),
      // A note not written yet has nothing to choose between: the row opens it to write.
      choices:
        note && onRemoveNote
          ? [
              {
                key: 'edit',
                label: 'Edit Note',
                detail: 'Read it, or change its words',
                icon: <EditGlyph />,
                run: () => onOpenNote(id),
              },
              {
                key: 'remove',
                label: 'Remove Note',
                detail: 'Its words go; undo brings them back',
                icon: <RemoveGlyph />,
                removes: true,
                run: () => onRemoveNote(id),
              },
            ]
          : undefined,
    });
  }

  return options;
}
