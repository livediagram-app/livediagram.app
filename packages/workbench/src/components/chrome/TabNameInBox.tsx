'use client';

// The open tab's name in the menu box (docs/specs/007-editor/toolbar-layout.md "The tab's name" in each product), on
// a desktop in every editor, after a hairline beside the menu button. A click (a tap) renames the tab, for someone who
// may. Each editor publishes the name and the rename through active-tab-name-store and hides this on a phone.
import { useState } from 'react';
import {
  activeTabRenameId,
  useActiveTabName,
  useActiveTabRename,
  type TabRename,
} from '../../hooks/editor/active-tab-name-store';

// The name's look: the chrome's text at regular weight (never bold), a little smaller than a header's, truncating.
export const IN_BOX_TITLE_CLASS =
  'min-w-0 max-w-[16rem] truncate text-[14px] font-normal leading-tight';

const FRAME =
  'ml-0.5 border-l border-slate-200 pl-2.5 pr-2 text-slate-800 dark:border-slate-700 dark:text-slate-100';

export function TabNameInBox({
  maxLength,
  className = '',
}: {
  // The product's longest tab name (its NAME_MAX_LENGTH).
  maxLength: number;
  // Extra classes on the frame (liveplanner hides the name while its slot holds an element's).
  className?: string;
}) {
  const name = useActiveTabName();
  const rename = useActiveTabRename();
  if (!name) return null;
  // Keyed by the tab it renames: another tab opening drops a draft begun on this one.
  return (
    <TabName
      key={rename?.tabId ?? ''}
      name={name}
      rename={rename}
      maxLength={maxLength}
      frame={className ? `${FRAME} ${className}` : FRAME}
    />
  );
}

function TabName({
  name,
  rename,
  maxLength,
  frame,
}: {
  name: string;
  rename: TabRename | null;
  maxLength: number;
  frame: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft !== null && rename) {
    const save = () => {
      const next = draft.trim();
      setDraft(null);
      // Saved only onto the tab it was begun on, should that tab no longer be the open one.
      if (activeTabRenameId() !== rename.tabId) return;
      if (next && next !== name) rename.rename(next);
    };
    return (
      <span data-tab-name-in-box="" className={`flex items-center ${frame}`}>
        <input
          autoFocus
          data-keeps-escape
          aria-label="Tab name"
          value={draft}
          maxLength={maxLength}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setDraft(null);
          }}
          className="w-48 rounded-md border border-brand-400 bg-transparent px-1.5 py-0.5 text-[14px] font-normal leading-tight outline-none"
        />
      </span>
    );
  }
  return (
    <span
      data-tab-name-in-box=""
      onClick={rename ? () => setDraft(name) : undefined}
      className={`${frame} ${rename ? 'cursor-text' : ''} ${IN_BOX_TITLE_CLASS}`}
    >
      {name}
    </span>
  );
}
