'use client';

// Ask AI wired into an editor in one call (liveworkspace/docs/specs/019-ask/ask.md "In each app"): the editor says
// which item is open, who is asking, its tabs and how to load the rest, and how to go to a source; this publishes the
// Tools row. Small on purpose: the tool loads when the row is opened (ask-tools-item.tsx).
import { useEffect, useMemo, useRef } from 'react';
import type { AppName } from '@liveworkspace/sites';
import { usePublishToolsItems } from '@liveworkspace/workbench/components/chrome/tools-door';
import type { ChromeToolsItem } from '@liveworkspace/workbench/components/chrome/ChromeToolsMenu';
import type { AskPassage } from '../passages';
import type { AskSource } from '../wire';
import { useAskToolsItem } from './ask-tools-item';
import type { AskHost } from './host';
import { tabPassages, type PassageTab, type TabPassageOptions } from './tab-passages';

export type AskToolInput = {
  app: AppName;
  /** The open item; null with none open (no row). */
  itemId: string | null;
  /** The signed-in account; null for a guest. */
  accountId: string | null;
  /** The editor's tabs, as its Search panel reads them. */
  tabs: readonly PassageTab[];
  /** Loads every tab not yet loaded (Search's prefetch). */
  loadAllTabs: () => Promise<unknown>;
  open: (source: AskSource) => void;
  suggestions?: readonly string[];
  /** How the app names an element's kind and what more of its words to read. */
  options?: TabPassageOptions;
  /** Passages beyond the tabs' elements (liveplanner's cards), read with them. */
  more?: () => readonly AskPassage[];
};

const NONE: readonly ChromeToolsItem[] = [];
// Tabs that loaded reach the editor's state in its next render: two frames is past it.
const settled = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') setTimeout(resolve, 32);
    else requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

/** Publishes the Ask AI row for the open item. */
export function useAskTool(input: AskToolInput): void {
  // The newest of everything, read when a question is asked: the host below keeps its identity while the item and
  // the person do, so the row is not rebuilt as the canvas changes.
  const live = useRef(input);
  useEffect(() => {
    live.current = input;
  });
  const { app, itemId, accountId } = input;
  const suggestions = input.suggestions;
  const host = useMemo<AskHost | null>(
    () =>
      itemId
        ? {
            app,
            itemId,
            accountId,
            passages: async () => {
              await live.current.loadAllTabs().catch(() => {});
              await settled();
              const now = live.current;
              return [...tabPassages(now.tabs, now.options), ...(now.more?.() ?? [])];
            },
            open: (source) => live.current.open(source),
            ...(suggestions ? { suggestions } : {}),
          }
        : null,
    [app, itemId, accountId, suggestions],
  );
  const item = useAskToolsItem(host);
  const items = useMemo(() => (item ? [item] : NONE), [item]);
  usePublishToolsItems('ask-ai', items);
}
