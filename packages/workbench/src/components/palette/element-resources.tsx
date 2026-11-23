'use client';

// What attaches to an element (each product's docs/specs/008-canvas/element-menu-quick-bar.md "Resources"): its
// Action, Comments, Link and Note, whichever the app offers. Built once here for every editor: the element menu
// reads the list to know whether to draw its Resources row, and the Resources dialog draws it. An option is offered
// when its handler is given, so an app without comments (or links, or notes) leaves that handler out.
import type { ReactNode } from 'react';
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

/** A place a link can go to, as the app's link picker names it. `kinds` are the link kinds it holds. */
export type ResourceLinkMode<M extends string> = {
  mode: M;
  label: string;
  detail: string;
  kinds: readonly string[];
};

/**
 * The link picker's three places: a web address, a tab, and the app's own file (a canvas, a plan, a design), named
 * as the picker names it.
 */
export function resourceLinkModes<M extends string>(file: {
  mode: M;
  label: string;
  detail: string;
}): ResourceLinkMode<'url' | 'tab' | M>[] {
  return [
    { mode: 'url', label: 'External URL', detail: 'A page on the web', kinds: ['url'] },
    {
      mode: 'tab',
      label: 'Tab',
      detail: 'Another tab, or an element on one',
      kinds: ['tab', 'element'],
    },
    { ...file, kinds: [file.mode] },
  ];
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
    if (link && !modes.some((m) => kind !== undefined && m.kinds.includes(kind)))
      choices.push({
        key: 'edit',
        label: 'Edit Link',
        detail: 'Change where it goes',
        icon: <EditGlyph />,
        run: () => onLinkElement(id),
      });
    for (const m of modes)
      choices.push({
        key: m.mode,
        label: m.label,
        detail: m.detail,
        icon: m.mode === 'url' ? <WebGlyph /> : m.mode === 'tab' ? <TabGlyph /> : <FileGlyph />,
        current: !!link && kind !== undefined && m.kinds.includes(kind),
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
