'use client';

import { Button, HoverCard, Tooltip } from '@liveknowledge/ui';
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
import { EditorDiscs } from './EditorDiscs';

// Edit, and the draft bar in its place while editing (docs/specs/030-knowledgebase/editing.md; blueprint "Presentation
// and UX"), in the top row before Page Info and Share. Reads the chrome store a slice at a time, so typing renders it
// only when what it says changes; its buttons call the newest handlers when pressed.

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
}: PageEditBarViewProps) {
  if (!mayEdit) return null;
  if (!editing)
    return (
      <HoverCard title="Edit" description="Change this page with anyone else editing it. Press E.">
        <Button
          variant="primary"
          size="xs"
          onClick={onEdit}
          data-page-edit=""
          className="mr-1 shrink-0"
        >
          <PencilIcon size={13} />
          Edit
        </Button>
      </HoverCard>
    );
  const names = editorsPhrase(others.map((o) => o.name));
  return (
    <div
      data-page-edit-bar=""
      role="group"
      aria-label="Editing This Page"
      className="mr-1 flex min-w-0 shrink-0 items-center gap-2 phone:gap-1.5"
    >
      {/* A phone keeps the row for the buttons, Page Info and Share: the others editing are in the meta row's note. */}
      <span className="contents phone:hidden">
        <EditorDiscs editors={others} label={`Also editing: ${names}`} />
      </span>
      <span
        aria-live="polite"
        data-page-edit-status=""
        className="flex min-w-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
      >
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
        {status ? (
          <>
            <span className="max-w-[22rem] truncate phone:hidden">{status}</span>
            <span className="hidden phone:inline-flex">
              <Tooltip label={status}>
                <span
                  tabIndex={0}
                  role="img"
                  aria-label={status}
                  className="inline-block size-1.5 rounded-full bg-amber-500"
                />
              </Tooltip>
            </span>
          </>
        ) : null}
      </span>
      <Button variant="ghost" size="xs" onClick={onCancel} data-page-edit-cancel="">
        Cancel
      </Button>
      <HoverCard
        title="Save"
        description={`Publish this draft for everyone. Press ${modifier()}+S.`}
      >
        <Button variant="primary" size="xs" onClick={onSave} data-page-edit-save="">
          Save
        </Button>
      </HoverCard>
    </div>
  );
}

/** The current page's Edit button or draft bar, from the editor's store. */
export function PageEditBar() {
  const store = useEditorChromeStore();
  const editing = useEditorChrome((s) => s.pageEditing.editing);
  const mayEdit = useEditorChrome((s) => s.pageEditing.mayEdit);
  const agentChanges = useEditorChrome((s) => s.pageEditing.agentChanges);
  const tabId = useEditorChrome((s) => s.pageTab.id);
  const me = useEditorChrome((s) => s.selfParticipant.name.trim() || 'Someone');
  const since = useEditorChrome((s) => s.pageEditing.since);
  // A relative time ticks with the shared clock; the draft's record moves at most once a minute.
  const now = useRelativeNow();
  const status = useEditorChrome((s) =>
    s.pageEditing.editing ? draftStatus(s.pageTab, { me, since, now }) : '',
  );
  const others = usePageEditors(tabId);
  return (
    <PageEditBarView
      editing={editing}
      mayEdit={mayEdit}
      status={status}
      agentChanges={agentChanges}
      others={others}
      onEdit={() => store.get().pageEditing.start()}
      onSave={() => store.get().pageEditing.save()}
      onCancel={() => void store.get().pageEditing.cancel()}
    />
  );
}
