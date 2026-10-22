'use client';

import { useState } from 'react';
import {
  activeTabRenameId,
  useActiveTabName,
  useActiveTabRename,
  type TabRename,
} from '@/hooks/editor/active-tab-name-store';
import { NAME_MAX_LENGTH } from '@livedesign/document';

// The name's look: the chrome's text at regular weight (never bold), a little smaller than a header's,
// truncating.
const IN_BOX_TITLE_CLASS = 'min-w-0 max-w-[16rem] truncate text-[14px] font-normal leading-tight';

// The open tab's name in the menu box (docs/specs/007-editor/toolbar-layout.md "The tab's name"), on a desktop.
export function TabNameInBox() {
  const name = useActiveTabName();
  const rename = useActiveTabRename();
  if (!name) return null;
  // Keyed by the tab it renames: another tab opening drops a draft begun on this one.
  return <TabName key={rename?.tabId ?? ''} name={name} rename={rename} />;
}

function TabName({ name, rename }: { name: string; rename: TabRename | null }) {
  const [draft, setDraft] = useState<string | null>(null);
  const frame =
    'ml-0.5 border-l border-slate-200 pl-2.5 pr-2 text-slate-800 dark:border-slate-700 dark:text-slate-100';
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
          maxLength={NAME_MAX_LENGTH}
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
      // A click (a tap) renames the tab, for someone who may.
      onClick={rename ? () => setDraft(name) : undefined}
      className={`${frame} ${rename ? 'cursor-text' : ''} ${IN_BOX_TITLE_CLASS}`}
    >
      {name}
    </span>
  );
}
