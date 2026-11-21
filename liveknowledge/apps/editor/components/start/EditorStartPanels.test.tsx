// @vitest-environment jsdom

// A structure asked for by link (docs/specs/007-editor/new-document-route.md "The other parameters",
// docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"): `/new?structure=<id>` queues the pick, and
// the start takes it as a click on its card would, never drawing itself; an id no structure has opens the start.
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  knowledgebaseStartOffered,
  offerKnowledgebaseStart,
  queueStructurePick,
  queuedStructurePick,
} from './knowledgebase-start';

const TAB = 'tab-1';
const state = vi.hoisted(() => ({
  value: {
    documentId: 'kb-1',
    hydrated: true,
    activeTab: { id: 'tab-1' },
    can: { editPages: true },
    isStructureReadOnly: false,
    setImportOpen: () => {},
  },
}));
const createStructure = vi.hoisted(() => vi.fn(async () => ({ imported: 1, first: null })));

vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorChromeStore: () => ({ get: () => state.value }),
  useEditorChrome: (pick: (s: typeof state.value) => unknown) => pick(state.value),
}));
vi.mock('@/components/start/useTemplateStartShown', () => ({ templateStartShownOf: () => true }));
vi.mock('@/lib/knowledge-setup/setup-empty', () => ({ pageIsUntouched: () => true }));
vi.mock('@/components/setup/useSetupOffered', () => ({ useSetupOffered: () => null }));
vi.mock('@/components/setup/create-structure', () => ({ createStructure }));
vi.mock('@/components/start/ExampleContentTray', () => ({
  ExampleContentTray: () => <div data-testid="tray" />,
}));
vi.mock('@/components/start/StartFromTemplates', () => ({
  StartFromTemplates: () => <div data-testid="start" />,
}));
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

const { EditorStartPanels } = await import('./EditorStartPanels');

beforeEach(() => {
  sessionStorage.clear();
  createStructure.mockClear();
});
afterEach(() => sessionStorage.clear());

describe('a structure asked for by link', () => {
  it('is picked on the start without the start being drawn, once', async () => {
    queueStructurePick(TAB, 'team-handbook');
    expect(knowledgebaseStartOffered(TAB)).toBe(true);
    const view = render(<EditorStartPanels />);
    expect(view.queryByTestId('start')).toBeNull();
    await waitFor(() => expect(createStructure).toHaveBeenCalledTimes(1));
    expect(createStructure).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'kb-1',
        replaceId: TAB,
        name: 'Team Handbook',
        from: 'FromStructure',
      }),
    );
    // Its tree: every page the structure has, Welcome first.
    const [args] = createStructure.mock.calls[0] as unknown as [{ pages: { title: string }[] }];
    expect(args.pages[0]!.title).toBe('Welcome');
    expect(args.pages).toHaveLength(11);
    // The pick is taken and the start closed: neither comes back.
    expect(queuedStructurePick(TAB)).toBeNull();
    expect(knowledgebaseStartOffered(TAB)).toBe(false);
    await act(async () => {});
    expect(createStructure).toHaveBeenCalledTimes(1);
  });

  it('opens the start as /new does when no structure has the id', async () => {
    queueStructurePick(TAB, 'no-such-structure');
    const view = render(<EditorStartPanels />);
    await waitFor(() => expect(queuedStructurePick(TAB)).toBeNull());
    expect(await view.findByTestId('start')).toBeTruthy();
    expect(createStructure).not.toHaveBeenCalled();
    expect(knowledgebaseStartOffered(TAB)).toBe(true);
  });

  it('leaves a start offered with nothing queued to the person', async () => {
    offerKnowledgebaseStart(TAB);
    const view = render(<EditorStartPanels />);
    expect(await view.findByTestId('start')).toBeTruthy();
    expect(createStructure).not.toHaveBeenCalled();
  });
});
