'use client';

import { HoverCard } from '@livediagram/ui';
import { SearchGlyph } from '@/components/chrome/tab-bar-icons';
import {
  HEADER_ACTION_BTN,
  HEADER_ACTION_TONE,
  HeaderGlyph,
} from '@/components/chrome/header-action';

// The Explorer header's Search (docs/specs/013-workspace/explorer-structure.md): the sidebar
// holds no search field, so search lives in the top bar, beside the account.
// Opens the same app-wide search panel as the bottom bar's Search.
export function HeaderSearchAction({ onOpen }: { onOpen: () => void }) {
  return (
    <HoverCard title="Search" description="Find documents, folders, tabs and elements.">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Search"
        className={`${HEADER_ACTION_BTN} ${HEADER_ACTION_TONE}`}
      >
        <HeaderGlyph>
          <SearchGlyph />
        </HeaderGlyph>
        <span aria-hidden>Search</span>
      </button>
    </HoverCard>
  );
}
