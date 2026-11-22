// What the Ask and AI Knowledge tests stand the editor's chrome store up with: one opened knowledgebase and a
// session of a given role.
import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import type { Tab } from '@liveknowledge/document';
import {
  EditorChromeContext,
  createEditorChromeStore,
  type EditorChromeStore,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';

export type Role = 'edit' | 'participate' | 'view';
export const ROLES: readonly Role[] = ['edit', 'participate', 'view'];

export const page = (id: string, name: string, parent?: string): Tab => ({
  id,
  name,
  elements: [],
  ...(parent ? { parent } : {}),
});

const PAGES = [page('p1', 'Release Process'), page('p2', 'Hotfixes', 'p1')];

export function chromeValue(
  role: Role = 'edit',
  over: Record<string, unknown> = {},
): EditorContextValue {
  return {
    hydrated: true,
    documentId: 'd1',
    documentName: 'Handbook',
    appChrome: true,
    embedMode: false,
    zenMode: false,
    anyWelcomeOpen: false,
    workbench: null,
    sessionCommunity: null,
    sessionTabScope: null,
    sessionShareCode: null,
    selfParticipant: { id: 'me', name: 'Ada Lovelace' },
    accountUserId: 'me',
    can: resolveEditorCapabilities(role),
    isStructureReadOnly: role === 'view',
    tabs: PAGES,
    activeId: 'p1',
    activeTab: PAGES[0],
    commentMentions: { candidates: [] },
    commitTabs: () => {},
    markTabLoaded: () => {},
    setActiveId: () => {},
    setSelectedId: () => {},
    setMultiSelectedIds: () => {},
    setEditingId: () => {},
    setFormatSourceId: () => {},
    ...over,
  } as unknown as EditorContextValue;
}

export function renderInEditor(
  ui: ReactElement,
  value: EditorContextValue = chromeValue(),
): RenderResult & { store: EditorChromeStore } {
  const store = createEditorChromeStore(value);
  const utils = render(
    <EditorChromeContext.Provider value={store}>{ui}</EditorChromeContext.Provider>,
  );
  return { store, ...utils };
}
