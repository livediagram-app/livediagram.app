'use client';

import type { ReactNode } from 'react';
import { useVersionHistoryState } from '@/lib/version-history-store';
import { useKnowledgeView } from '@/lib/knowledge-ask/useKnowledgeView';
import { lucideCheck, lucideX } from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph, Portal, Tooltip } from '@liveknowledge/ui';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { PencilIcon } from '@/components/primitives/explorer-icons';
import { usePageEditors, type PageEditor } from '@/lib/page-edit/page-edit-store';
import {
  agentChangeDetail,
  draftStatus,
  editorsPhrase,
  modifierName,
} from '@/lib/page-edit/page-edit-text';
import { useRelativeNow } from '@/lib/relative-time';
import { DoubleClickToEdit } from './DoubleClickToEdit';
import { EditorDiscs } from './EditorDiscs';
import { PageReactions } from '@/components/page-reactions/PageReactions';
import { useArticleZoneCorner } from './useArticleZoneCorner';
import { templateStartShownOf } from '@/components/start/useTemplateStartShown';
import { useKnowledgebaseStartOffered } from '@/components/start/knowledgebase-start';

// Edit, with the page's reactions left of it, and while editing the draft bar, floating at the bottom right of the
// article zone (docs/specs/030-knowledgebase/editing.md; blueprint "Presentation and UX"). Reads the chrome store a slice at a time, so typing renders it
// only when what it says changes; its buttons call the newest handlers when pressed.

// The floating buttons: Edit, Cancel and Save share one height, shape and lift (owner 2026-11-21: "same size as the
// edit button"), each standing on its own over the page, no capsule round them.
const PILL =
  'inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl text-[13px] font-semibold shadow-lg motion-safe:transition-colors motion-safe:duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 phone:h-11';
const BRAND =
  'bg-brand-700 pr-2 text-white shadow-brand-900/25 hover:bg-brand-800 focus-visible:outline-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500';

const CheckIcon = lucideGlyph(lucideCheck, 14);
const XIcon = lucideGlyph(lucideX, 14);

// A key's hint inside a button, quieter than the label: its chip, not its words, is the quieter part, so the words
// hold 4.5:1 on the accent (lighter in dark mode, where the chip darkens it rather than lightening it).
function Kbd({ children }: { tone: 'onBrand'; children: string }) {
  return (
    <kbd
      aria-hidden
      className="rounded-md bg-white/15 px-1.5 py-px font-sans text-[11px] font-medium text-white phone:hidden dark:bg-black/20"
    >
      {children}
    </kbd>
  );
}

const modifier = () =>
  modifierName(typeof navigator === 'undefined' ? undefined : navigator.platform);

export type PageEditBarViewProps = {
  editing: boolean;
  mayEdit: boolean;
  status: string;
  agentChanges: number;
  others: readonly PageEditor[];
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  // The page's reactions (docs/specs/030-knowledgebase/page-reactions.md): left of Edit while reading. Absent where
  // they are not shown (Zen Mode, an embed); someone who may not edit has them left of Zen (PageReactionsBesideZen).
  reactions?: ReactNode;
};

/** The bar itself, from plain props (tests, and the store-reading wrapper below). */
export function PageEditBarView({
  editing,
  mayEdit,
  status,
  agentChanges,
  others,
  onEdit,
  onSave,
  onCancel,
  reactions,
}: PageEditBarViewProps) {
  const corner = useArticleZoneCorner(mayEdit);
  if (!mayEdit) return null;
  if (!editing)
    return (
      <Portal>
        <div
          style={{ right: corner.right, bottom: corner.bottom }}
          // Toasts stand on this button's line, beside it (liveworkspace toasts.md "Placement").
          data-toast-side=""
          data-page-read-corner=""
          className="fixed z-[var(--z-toolbar)] flex items-center gap-2 phone:gap-1.5"
        >
          {reactions}
          {/* No tooltip (owner 2026-11-21): the label and the key say it. */}
          <button
            type="button"
            onClick={onEdit}
            data-page-edit=""
            className={`${PILL} ${BRAND} pl-3 lk-pop-in`}
          >
            <PencilIcon size={14} />
            Edit
            <Kbd tone="onBrand">E</Kbd>
          </button>
        </div>
      </Portal>
    );
  const names = editorsPhrase(others.map((o) => o.name));
  const unsaved = status !== '';
  return (
    <Portal>
      <div
        data-page-edit-bar=""
        data-toast-side=""
        role="group"
        aria-label="Editing This Page"
        style={{ right: corner.right, bottom: corner.bottom }}
        className="fixed z-[var(--z-toolbar)] flex min-w-0 items-center gap-2 phone:gap-1.5"
      >
        {/* A phone keeps the row for the buttons, Page Info and Share: the others editing are in the meta row's note. */}
        <span className="contents phone:hidden">
          <EditorDiscs editors={others} label={`Also editing: ${names}`} />
        </span>
        {/* The draft's state when there is one to tell (unsaved changes, an agent's change), a quiet note on the
          page's ground, then Cancel and Save. No "Editing" label (owner 2026-11-21): the buttons say it. */}
        <span
          aria-live="polite"
          data-page-edit-status=""
          className={`flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 ${
            unsaved || agentChanges > 0 ? 'pr-1' : ''
          }`}
        >
          {unsaved ? (
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-amber-500" />
          ) : null}
          {agentChanges > 0 ? (
            <HoverCard
              title="An Agent Changed the Saved Page"
              description={agentChangeDetail(agentChanges)}
            >
              <span
                tabIndex={0}
                data-page-edit-agent=""
                className="truncate text-amber-700 phone:hidden dark:text-amber-300"
              >
                An agent changed the saved page
              </span>
            </HoverCard>
          ) : null}
          {unsaved ? (
            <>
              <span className="max-w-[18rem] truncate phone:hidden">{status}</span>
              <span className="hidden phone:inline-flex">
                <Tooltip label={status}>
                  <span tabIndex={0} role="img" aria-label={status} className="text-[11px]">
                    Unsaved
                  </span>
                </Tooltip>
              </span>
            </>
          ) : null}
        </span>
        <button
          type="button"
          onClick={onCancel}
          data-page-edit-cancel=""
          className={`${PILL} lk-pop-in bg-white pl-3 pr-3.5 text-slate-700 shadow-slate-900/10 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-slate-400 dark:bg-slate-800 dark:text-slate-200 dark:shadow-black/40 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-white`}
        >
          <XIcon />
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          data-page-edit-save=""
          // A px more before the tick than before the pencil: the tick's ink stands further inside its box, and
          // the key's chip is too faint to count, so with pl-3 the contents sat 0.6 px left of centre
          // (optical-alignment.md).
          className={`${PILL} ${BRAND} pl-[13px] lk-pop-in`}
        >
          <CheckIcon />
          Save
          <Kbd tone="onBrand">{modifier() === 'Cmd' ? '⌘S' : 'Ctrl S'}</Kbd>
        </button>
      </div>
    </Portal>
  );
}

/** The current page's Edit button or draft bar, from the editor's store. */
export function PageEditBar() {
  const store = useEditorChromeStore();
  const editing = useEditorChrome((s) => s.pageEditing.editing);
  const mayEdit = useEditorChrome((s) => s.pageEditing.mayEdit);
  const agentChanges = useEditorChrome((s) => s.pageEditing.agentChanges);
  const tabId = useEditorChrome((s) => s.pageTab.id);
  const me = useEditorChrome((s) => s.selfParticipant.name.trim() || 'Guest');
  const since = useEditorChrome((s) => s.pageEditing.since);
  // A relative time ticks with the shared clock; the draft's record moves at most once a minute.
  const now = useRelativeNow();
  const status = useEditorChrome((s) =>
    s.pageEditing.editing ? draftStatus(s.pageTab, { me, since, now }) : '',
  );
  const others = usePageEditors(tabId);
  // Version History covers the page: no Edit floating over it, nor double-click to edit beneath it.
  const inHistory = useVersionHistoryState() !== null;
  // Ask and AI Knowledge are not a page: no Edit there either (owner 2026-11-21).
  const onPages = useKnowledgeView() === 'pages';
  // A new knowledgebase's start screen covers its first page: no Cancel and Save floating beside it.
  const startMayShow = useEditorChrome(templateStartShownOf);
  const startOffered = useKnowledgebaseStartOffered(tabId);
  // Reactions stand down in Zen Mode and in an embed (page-reactions.md "Where they show").
  const reactionsShown = useEditorChrome((s) => !s.embedMode && !s.zenMode);
  if (inHistory || !onPages || (startMayShow && startOffered)) return null;
  return (
    <>
      <DoubleClickToEdit
        active={mayEdit && !editing}
        onEdit={() => store.get().pageEditing.start()}
      />
      <PageEditBarView
        editing={editing}
        mayEdit={mayEdit}
        status={status}
        agentChanges={agentChanges}
        others={others}
        onEdit={() => store.get().pageEditing.start()}
        onSave={() => store.get().pageEditing.save()}
        onCancel={() => void store.get().pageEditing.cancel()}
        reactions={reactionsShown ? <PageReactions /> : undefined}
      />
    </>
  );
}
