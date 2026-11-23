'use client';

// The open page's cover in the editor (docs/specs/030-knowledgebase/page-surface.md "The cover"; blueprint:
// docs/specs/030-knowledgebase/blueprints/page-surface.md "The cover"): read from the store, settled as every stored
// cover is (a peer's tab-meta patch is untrusted), and written as the page's own meta, outside the writing and its
// draft, so it rides the tab's save and its `tab-meta` op as a rename does.
import { useMemo } from 'react';
import {
  coverThemeFrom,
  parseTabCover,
  themeBackgroundPresets,
  type KnowledgeStyle,
  type Tab,
  type TabCover,
  type ThemeBackgroundPreset,
  type ThemeDefinition,
} from '@liveknowledge/document';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useOpenKnowledgeStyle } from '@/components/knowledge-style/useOpenKnowledgeStyle';
import { knowledgeWritingAccent } from '@/lib/knowledge-style/knowledge-accent';
import { getTheme } from '@/lib/themes';
import { track } from '@/lib/telemetry';

// Settled once per stored value: the band and the meta row read it on every store change.
const settled = new WeakMap<object, TabCover | undefined>();
export function coverOfTab(tab: Pick<Tab, 'cover'>): TabCover | undefined {
  const raw: unknown = tab.cover;
  if (!raw || typeof raw !== 'object') return undefined;
  if (settled.has(raw)) return settled.get(raw);
  const cover = parseTabCover(raw);
  settled.set(raw, cover);
  return cover;
}

export type CoverTheme = Pick<ThemeDefinition, 'elementStroke' | 'palette'>;

/** The colours a gradient or animated cover is painted in: the knowledgebase's writing accent (its theme's own, or
 *  the one picked in Knowledgebase Style) and its theme's next colours. */
export function coverThemeOf(style: Pick<KnowledgeStyle, 'theme' | 'accent'>): CoverTheme {
  return coverThemeFrom(getTheme(style.theme, 'light'), knowledgeWritingAccent(style));
}

/** The open knowledgebase's cover colours and their gradients; worked out again only when its style changes. */
export function useCoverTheme(): { theme: CoverTheme; presets: readonly ThemeBackgroundPreset[] } {
  const style = useOpenKnowledgeStyle();
  return useMemo(() => {
    const theme = coverThemeOf(style);
    return { theme, presets: themeBackgroundPresets(theme) };
  }, [style]);
}

/** The open page's cover, settled; undefined when it has none. */
export function usePageCover(): TabCover | undefined {
  return useEditorChrome((s) => coverOfTab(s.activeTab));
}

export function usePageHasCover(): boolean {
  return useEditorChrome((s) => coverOfTab(s.activeTab) !== undefined);
}

// Read and edit modes (docs/specs/030-knowledgebase/editing.md), where the editor has them: an Editor changes the
// cover in edit mode only. Read loosely, so the cover needs nothing of them where they are not built.
type MaybeEditing = { pageEditing?: { editing: boolean } };

/** Whether this person may change the open page's cover: an Editor (never a Participant, a Viewer or a link
 *  visitor), and only while the page is being edited where pages have read and edit modes. */
export function coverEditable(s: {
  isReadOnly: boolean;
  participating: boolean;
  pageEditing?: { editing: boolean } | undefined;
}): boolean {
  if (s.isReadOnly || s.participating) return false;
  return s.pageEditing ? s.pageEditing.editing : true;
}

/** Whether this person may add a cover or an icon to the open page (Add Cover, Add Icon in the meta row): the
 *  cover's writers, whether the page is being read or edited (owner 2026-11-23: "I should also see Add Cover and Add
 *  Icon and Add Label even when the page isn't in edit mode"). Changing one stays an edit-mode control. */
export function coverAddable(s: { isReadOnly: boolean; participating: boolean }): boolean {
  return !s.isReadOnly && !s.participating;
}

export function useCoverAddable(): boolean {
  return useEditorChrome(coverAddable);
}

export function useCoverEditable(): boolean {
  return useEditorChrome((s) =>
    coverEditable({
      isReadOnly: s.isReadOnly,
      participating: s.participating,
      pageEditing: (s as MaybeEditing).pageEditing,
    }),
  );
}

/** Puts `cover` on a tab, or takes it off with undefined; the same tab when nothing changes. */
export function withTabCover<T extends Tab>(tab: T, cover: TabCover | undefined): T {
  if (cover === undefined) {
    if (!('cover' in tab)) return tab;
    const { cover: _gone, ...rest } = tab;
    void _gone;
    return rest as T;
  }
  return { ...tab, cover };
}

export type CoverWriter = (cover: TabCover | undefined) => void;

/** The writer of the open page's cover: one commit, which saves it and tells the room. */
export function useSetPageCover(): CoverWriter {
  const chrome = useEditorChromeStore();
  return (cover) => {
    const s = chrome.get();
    const id = s.activeTab.id;
    const had = coverOfTab(s.activeTab) !== undefined;
    s.commitTabs((ts) => ts.map((t) => (t.id === id ? withTabCover(t, cover) : t)));
    if (cover && !had) track('Element', 'Added', 'Cover');
    if (!cover && had) track('Element', 'Deleted', 'Cover');
  };
}
